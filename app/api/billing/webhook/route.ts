import { NextResponse } from 'next/server';
import { stripe, STRIPE_TEAMS_PRICE_ID } from '@/lib/stripe/client';
import {
    updateAccountSubscription,
    getAccountByStripeCustomerId,
    getOrganizationByStripeCustomerId,
    updateOrganizationSubscription,
} from '@/lib/neon/queries';
import { applyEarnedReferralCredits } from '@/lib/referrals/referral-credit-service';
import Stripe from 'stripe';

function isPaidStripeStatus(status: Stripe.Subscription.Status) {
    return status === 'active' || status === 'trialing';
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

export async function POST(request: Request) {
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

        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                if (session.mode === 'subscription') {
                    const customerId = getExpandableId(session.customer);
                    const subscriptionId = getExpandableId(session.subscription);
                    if (!customerId || !subscriptionId) {
                        throw new Error('Subscription checkout session is missing customer or subscription ID');
                    }

                    const account = await getAccountByStripeCustomerId(customerId);
                    if (account) {
                        const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId);
                        await updateAccountSubscription(account.id, {
                            subscriptionStatus: 'pro',
                            subscriptionId: subscriptionResponse.id,
                            subscriptionEndsAt: getSubscriptionEndsAt(subscriptionResponse),
                        });
                        await applyEarnedReferralCredits(account.id, {
                            requireActiveSubscription: false,
                        });
                        console.log(`Activated Pro subscription for account ${account.id}`);
                        break;
                    }

                    const organization = await getOrganizationByStripeCustomerId(customerId);
                    if (organization) {
                        const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId);
                        const seatQuantity = getSeatQuantityFromSubscription(subscriptionResponse);

                        await updateOrganizationSubscription(organization.id, {
                            subscriptionStatus: isPaidStripeStatus(subscriptionResponse.status) ? 'team' : 'free',
                            subscriptionId: subscriptionResponse.id,
                            subscriptionEndsAt: getSubscriptionEndsAt(
                                subscriptionResponse,
                                STRIPE_TEAMS_PRICE_ID
                            ),
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

                const account = await getAccountByStripeCustomerId(customerId);
                if (account) {
                    // Map Stripe status to our Plan type ('free' | 'pro')
                    const status = isPaidStripeStatus(subscription.status) ? 'pro' : 'free';

                    await updateAccountSubscription(account.id, {
                        subscriptionStatus: status,
                        subscriptionId: subscription.id,
                        subscriptionEndsAt: getSubscriptionEndsAt(subscription),
                    });
                    console.log(`Updated subscription status to ${status} for account ${account.id}`);
                    break;
                }

                const organization = await getOrganizationByStripeCustomerId(customerId);
                if (organization) {
                    const status = isPaidStripeStatus(subscription.status) ? 'team' : 'free';
                    const seatQuantity = getSeatQuantityFromSubscription(subscription);

                    await updateOrganizationSubscription(organization.id, {
                        subscriptionStatus: status,
                        subscriptionId: subscription.id,
                        subscriptionEndsAt: getSubscriptionEndsAt(
                            subscription,
                            STRIPE_TEAMS_PRICE_ID
                        ),
                        seatQuantity,
                    });
                    console.log(`Updated Teams subscription status to ${status} for organization ${organization.id}`);
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = typeof subscription.customer === 'string'
                    ? subscription.customer
                    : subscription.customer.id;

                const account = await getAccountByStripeCustomerId(customerId);
                if (account) {
                    await updateAccountSubscription(account.id, {
                        subscriptionStatus: 'free',
                        subscriptionId: null,
                        subscriptionEndsAt: null,
                    });
                    console.log(`Downgraded to free plan for account ${account.id}`);
                    break;
                }

                const organization = await getOrganizationByStripeCustomerId(customerId);
                if (organization) {
                    await updateOrganizationSubscription(organization.id, {
                        subscriptionStatus: 'free',
                        subscriptionId: null,
                        subscriptionEndsAt: null,
                        seatQuantity: 0,
                    });
                    console.log(`Downgraded to free plan for organization ${organization.id}`);
                }
                break;
            }

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
    }
}
