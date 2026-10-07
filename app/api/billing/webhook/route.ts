import { NextResponse } from 'next/server';
import { stripe, STRIPE_TEAMS_PRICE_ID } from '@/lib/stripe/client';
import {
    updateAccountSubscription,
    getAccountById,
    getAccountByStripeCustomerId,
    getOrganizationById,
    getOrganizationByStripeCustomerId,
    getOrganizationSeatUsage,
    transferAccountSubscriptionToOrganization,
    updateOrganizationSubscription,
} from '@/lib/neon/queries';
import { applyEarnedReferralCredits } from '@/lib/referrals/referral-credit-service';
import { errorNameOf, recordOperationalEvent, recordOperationalSuccess } from '@/lib/ops/events';
import { getSubscriptionCancelAt } from '@/lib/stripe/subscriptions';
import Stripe from 'stripe';

function isPaidStripeStatus(status: Stripe.Subscription.Status) {
    return status === 'active' || status === 'trialing';
}

/** True when an event that would end a plan is about a subscription other than the stored one. */
function endsAnotherSubscription(storedSubscriptionId: unknown, subscription: Stripe.Subscription) {
    return !isPaidStripeStatus(subscription.status)
        && Boolean(storedSubscriptionId)
        && storedSubscriptionId !== subscription.id;
}

function getExpandableId(value: string | { id: string } | null): string | null {
    if (typeof value === 'string') {
        return value || null;
    }

    return value?.id || null;
}

function getRelevantSubscriptionItem(
    subscription: Stripe.Subscription,
    priceId = ''
): Stripe.SubscriptionItem | undefined {
    const items = subscription.items?.data || [];
    return priceId ? items.find((item) => item.price?.id === priceId) : items[0];
}

function getSubscriptionEndsAt(subscription: Stripe.Subscription, priceId = ''): Date | null {
    const periodEnd = getRelevantSubscriptionItem(subscription, priceId)?.current_period_end;
    return periodEnd ? new Date(periodEnd * 1000) : null;
}

function getSeatQuantityFromSubscription(subscription: Stripe.Subscription) {
    const qty = getRelevantSubscriptionItem(subscription, STRIPE_TEAMS_PRICE_ID)?.quantity;
    return typeof qty === 'number' ? qty : null;
}

function getMetadataId(metadata: Stripe.Metadata | null | undefined, key: string): string | null {
    const value = metadata?.[key]?.trim();
    return value || null;
}

/**
 * Seats are normally changed in the app, which never lets them fall below the
 * number of members. A change made directly in Stripe can; nobody loses access,
 * so the owner is told instead. Never fails the webhook.
 */
async function flagSeatsBelowMembers(organizationId: string, seatQuantity: number | null) {
    if (seatQuantity === null) return;
    try {
        const { used } = await getOrganizationSeatUsage(organizationId);
        if (used > seatQuantity) {
            await recordOperationalEvent({
                category: 'billing_webhook',
                code: 'seats_below_members',
                outcome: 'failure',
                severity: 'warning',
            });
        }
    } catch (error) {
        console.error('Failed to compare Teams seats with members:', error);
    }
}

async function syncOrganizationSubscription(
    organizationId: string,
    subscription: Stripe.Subscription
) {
    const customerId = getExpandableId(subscription.customer);
    if (!customerId) {
        throw new Error('Teams subscription is missing a customer ID');
    }

    const convertedFromAccountId = getMetadataId(
        subscription.metadata,
        'converted_from_account_id'
    );
    const status = isPaidStripeStatus(subscription.status) ? 'team' : 'free';
    const seatQuantity = getSeatQuantityFromSubscription(subscription);
    const subscriptionEndsAt = getSubscriptionEndsAt(subscription, STRIPE_TEAMS_PRICE_ID);

    if (status === 'team' && convertedFromAccountId) {
        if (!seatQuantity) {
            throw new Error('Converted Teams subscription is missing its seat quantity');
        }

        const transferred = await transferAccountSubscriptionToOrganization({
            accountId: convertedFromAccountId,
            organizationId,
            stripeCustomerId: customerId,
            subscriptionId: subscription.id,
            subscriptionEndsAt,
            subscriptionCancelAt: getSubscriptionCancelAt(subscription, subscriptionEndsAt),
            seatQuantity,
        });
        if (!transferred) {
            throw new Error('Failed to transfer converted Teams billing ownership');
        }
        return;
    }

    const organization = await getOrganizationById(organizationId);
    if (!organization) {
        // Account closure cancels a sole member's Team plan and then deletes the
        // workspace, so the final events can arrive with nothing left to update.
        if (status !== 'team') {
            console.log(`Ignored ended Teams subscription for removed organization ${organizationId}`);
            return;
        }
        throw new Error('Teams subscription organization not found');
    }

    // Same rule as for Pro accounts: only the stored subscription can end the plan.
    if (endsAnotherSubscription(organization.subscription_id, subscription)) {
        console.log(`Ignored ${subscription.status} subscription that is not current for organization ${organizationId}`);
        return;
    }

    if (
        status === 'team'
        && organization.subscription_status === 'team'
        && organization.subscription_id
        && organization.subscription_id !== subscription.id
    ) {
        await recordOperationalEvent({
            category: 'billing_webhook',
            code: 'duplicate_subscription',
            outcome: 'failure',
            severity: 'critical',
        });
    }

    await updateOrganizationSubscription(organization.id, {
        subscriptionStatus: status,
        subscriptionId: status === 'team' ? subscription.id : null,
        subscriptionEndsAt: status === 'team' ? subscriptionEndsAt : null,
        subscriptionCancelAt: status === 'team'
            ? getSubscriptionCancelAt(subscription, subscriptionEndsAt)
            : null,
        seatQuantity: status === 'team' ? seatQuantity : 0,
    });
    if (status === 'team') await flagSeatsBelowMembers(organization.id, seatQuantity);
}

async function syncAccountSubscription(accountId: string, subscription: Stripe.Subscription) {
    const account = await getAccountById(accountId);
    if (!account) {
        throw new Error('Pro subscription account not found');
    }

    if (account.closure_status === 'closing' || account.closure_status === 'closed') {
        console.log(`Ignored subscription event for ${account.closure_status} account ${accountId}`);
        return false;
    }

    const status = isPaidStripeStatus(subscription.status) ? 'pro' : 'free';
    const currentSubscriptionId = (account.subscription_id as string | null) || null;
    const isAnotherSubscription = Boolean(currentSubscriptionId) && currentSubscriptionId !== subscription.id;

    // An ended or expired subscription that is not the one this account is on
    // (a replaced plan, an abandoned checkout, a late event) must not downgrade it.
    if (endsAnotherSubscription(currentSubscriptionId, subscription)) {
        console.log(`Ignored ${subscription.status} subscription that is not current for account ${accountId}`);
        return false;
    }

    // Two paid subscriptions bill the customer twice. No provider event ID: this
    // handler's own success row would otherwise mark the incident recovered.
    if (status === 'pro' && isAnotherSubscription && account.subscription_status === 'pro') {
        await recordOperationalEvent({
            category: 'billing_webhook',
            code: 'duplicate_subscription',
            outcome: 'failure',
            severity: 'critical',
            accountId: account.id,
        });
    }

    const subscriptionEndsAt = getSubscriptionEndsAt(subscription);
    await updateAccountSubscription(account.id, {
        subscriptionStatus: status,
        subscriptionId: status === 'pro' ? subscription.id : null,
        subscriptionEndsAt: status === 'pro' ? subscriptionEndsAt : null,
        subscriptionCancelAt: status === 'pro'
            ? getSubscriptionCancelAt(subscription, subscriptionEndsAt)
            : null,
        // The referral free month: it ends on this date unless a card is on file.
        subscriptionTrialEndsAt: subscription.status === 'trialing' && subscription.trial_end
            ? new Date(subscription.trial_end * 1000)
            : null,
    });
    return true;
}

export async function POST(request: Request) {
    // Set only after the signature is verified, so unverified requests never become billing incidents.
    let verifiedEvent: { id: string; type: string } | null = null;
    try {
        if (!stripe) {
            return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
        }

        const body = await request.text();
        const sig = request.headers.get('stripe-signature');

        if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
            return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
        }

        let event: Stripe.Event;
        try {
            event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown verification error';
            console.error('Webhook signature verification failed:', message);
            return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
        }
        verifiedEvent = { id: event.id, type: event.type };

        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                if (session.mode === 'subscription') {
                    const customerId = getExpandableId(session.customer);
                    const subscriptionId = getExpandableId(session.subscription);
                    if (!customerId || !subscriptionId) {
                        throw new Error('Subscription checkout session is missing customer or subscription ID');
                    }

                    const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId);
                    const organizationId =
                        getMetadataId(subscriptionResponse.metadata, 'organization_id') ||
                        getMetadataId(session.metadata, 'organization_id');
                    if (organizationId) {
                        await syncOrganizationSubscription(organizationId, subscriptionResponse);
                        console.log(`Activated Teams subscription for organization ${organizationId}`);
                        break;
                    }

                    const accountId =
                        getMetadataId(subscriptionResponse.metadata, 'account_id') ||
                        getMetadataId(session.metadata, 'account_id');
                    if (accountId) {
                        const updated = await syncAccountSubscription(accountId, subscriptionResponse);
                        if (updated) {
                            await applyEarnedReferralCredits(accountId, {
                                requireActiveSubscription: false,
                            });
                            console.log(`Activated Pro subscription for account ${accountId}`);
                        }
                        break;
                    }

                    const account = await getAccountByStripeCustomerId(customerId);
                    if (account) {
                        const updated = await syncAccountSubscription(account.id, subscriptionResponse);
                        if (updated) {
                            await applyEarnedReferralCredits(account.id, {
                                requireActiveSubscription: false,
                            });
                            console.log(`Activated Pro subscription for account ${account.id}`);
                        }
                        break;
                    }

                    const organization = await getOrganizationByStripeCustomerId(customerId);
                    if (organization) {
                        const seatQuantity = getSeatQuantityFromSubscription(subscriptionResponse);
                        const subscriptionEndsAt = getSubscriptionEndsAt(
                            subscriptionResponse,
                            STRIPE_TEAMS_PRICE_ID
                        );

                        await updateOrganizationSubscription(organization.id, {
                            subscriptionStatus: isPaidStripeStatus(subscriptionResponse.status) ? 'team' : 'free',
                            subscriptionId: subscriptionResponse.id,
                            subscriptionEndsAt,
                            subscriptionCancelAt: getSubscriptionCancelAt(subscriptionResponse, subscriptionEndsAt),
                            seatQuantity,
                        });
                        console.log(`Activated Teams subscription for organization ${organization.id}`);
                    }
                }
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = typeof subscription.customer === 'string'
                    ? subscription.customer
                    : subscription.customer.id;

                const organizationId = getMetadataId(subscription.metadata, 'organization_id');
                if (organizationId) {
                    await syncOrganizationSubscription(organizationId, subscription);
                    console.log(`Updated Teams subscription for organization ${organizationId}`);
                    break;
                }

                const accountId = getMetadataId(subscription.metadata, 'account_id');
                if (accountId) {
                    if (await syncAccountSubscription(accountId, subscription)) {
                        console.log(`Updated Pro subscription for account ${accountId}`);
                    }
                    break;
                }

                const account = await getAccountByStripeCustomerId(customerId);
                if (account) {
                    await syncAccountSubscription(account.id, subscription);
                    break;
                }

                const organization = await getOrganizationByStripeCustomerId(customerId);
                if (organization && endsAnotherSubscription(organization.subscription_id, subscription)) {
                    console.log(`Ignored ${subscription.status} subscription that is not current for organization ${organization.id}`);
                    break;
                }
                if (organization) {
                    const status = isPaidStripeStatus(subscription.status) ? 'team' : 'free';
                    const seatQuantity = getSeatQuantityFromSubscription(subscription);
                    const subscriptionEndsAt = getSubscriptionEndsAt(subscription, STRIPE_TEAMS_PRICE_ID);

                    await updateOrganizationSubscription(organization.id, {
                        subscriptionStatus: status,
                        subscriptionId: subscription.id,
                        subscriptionEndsAt,
                        subscriptionCancelAt: status === 'team'
                            ? getSubscriptionCancelAt(subscription, subscriptionEndsAt)
                            : null,
                        seatQuantity,
                    });
                    if (status === 'team') await flagSeatsBelowMembers(organization.id, seatQuantity);
                    console.log(`Updated Teams subscription status to ${status} for organization ${organization.id}`);
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = typeof subscription.customer === 'string'
                    ? subscription.customer
                    : subscription.customer.id;

                const organizationId = getMetadataId(subscription.metadata, 'organization_id');
                if (organizationId) {
                    await syncOrganizationSubscription(organizationId, subscription);
                    console.log(`Downgraded organization ${organizationId} to free`);
                    break;
                }

                const accountId = getMetadataId(subscription.metadata, 'account_id');
                if (accountId) {
                    if (await syncAccountSubscription(accountId, subscription)) {
                        console.log(`Downgraded account ${accountId} to free`);
                    }
                    break;
                }

                const account = await getAccountByStripeCustomerId(customerId);
                if (account) {
                    await syncAccountSubscription(account.id, subscription);
                    break;
                }

                const organization = await getOrganizationByStripeCustomerId(customerId);
                if (organization && endsAnotherSubscription(organization.subscription_id, subscription)) {
                    console.log(`Ignored ended subscription that is not current for organization ${organization.id}`);
                    break;
                }
                if (organization) {
                    await updateOrganizationSubscription(organization.id, {
                        subscriptionStatus: 'free',
                        subscriptionId: null,
                        subscriptionEndsAt: null,
                        subscriptionCancelAt: null,
                        seatQuantity: 0,
                    });
                    console.log(`Downgraded to free plan for organization ${organization.id}`);
                }
                break;
            }

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        // Recovery is linked to an earlier failure by Stripe event identity.
        await recordOperationalSuccess({
            category: 'billing_webhook',
            code: 'processing_failed',
            providerEventId: event.id,
            metadata: { eventType: event.type },
        });
        return NextResponse.json({ received: true });
    } catch (error) {
        if (verifiedEvent) {
            await recordOperationalEvent({
                category: 'billing_webhook',
                code: 'processing_failed',
                outcome: 'failure',
                severity: 'critical',
                providerEventId: verifiedEvent.id,
                metadata: { eventType: verifiedEvent.type, errorName: errorNameOf(error) },
            });
        }
        console.error('Webhook error:', error);
        return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
    }
}
