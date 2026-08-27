import { NextResponse } from 'next/server';
import { stripe, STRIPE_PRO_PRICE_ID, STRIPE_TEAMS_PRICE_ID } from '@/lib/stripe/client';
import { stackServerApp } from '@/lib/stack/server';
import {
    getOrCreateAccount,
    getOrganizationById,
    getOrganizationMemberRole,
    getOrganizationSeatUsage,
    transferAccountSubscriptionToOrganization,
    updateOrganizationStripeCustomer,
} from '@/lib/neon/queries';

function getStripeId(value: string | { id: string } | null): string | null {
    return typeof value === 'string' ? value : value?.id || null;
}

function getSubscriptionEndsAt(subscription: Awaited<ReturnType<NonNullable<typeof stripe>['subscriptions']['retrieve']>>) {
    const teamItem = subscription.items.data.find((item) => item.price.id === STRIPE_TEAMS_PRICE_ID);
    return teamItem?.current_period_end
        ? new Date(teamItem.current_period_end * 1000)
        : null;
}

function getMinSeats(): number {
    const raw = process.env.TEAM_MIN_SEATS;
    const parsed = raw ? Number(raw) : 3;
    return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 3;
}

export async function POST(request: Request) {
    try {
        if (!stripe) {
            return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
        }
        if (!STRIPE_TEAMS_PRICE_ID) {
            return NextResponse.json({ error: 'Teams price not configured' }, { status: 500 });
        }

        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const account = await getOrCreateAccount(user.id, user.primaryEmail || '', user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        const organizationId = account.active_organization_id as string | null;
        if (!organizationId) {
            return NextResponse.json({ error: 'No active organization' }, { status: 404 });
        }

        const role = await getOrganizationMemberRole(organizationId, account.id);
        if (role !== 'admin') {
            return NextResponse.json({ error: 'Only organization admins can manage billing' }, { status: 403 });
        }

        const organization = await getOrganizationById(organizationId);
        if (!organization) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        if (organization.subscription_status === 'team' && organization.subscription_id) {
            return NextResponse.json(
                { error: 'Organization already subscribed', message: 'Open the billing portal to manage seats.' },
                { status: 409 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const seatsRaw = body?.seats;
        const requestedSeats = typeof seatsRaw === 'number' ? seatsRaw : Number.parseInt(String(seatsRaw || ''), 10);
        const minSeats = getMinSeats();
        const seats = Number.isFinite(requestedSeats) && requestedSeats > 0 ? Math.floor(requestedSeats) : minSeats;
        if (seats < minSeats) {
            return NextResponse.json({ error: `Minimum is ${minSeats} seats` }, { status: 400 });
        }

        const seatUsage = await getOrganizationSeatUsage(organizationId);
        const reservedSeats = seatUsage.used + seatUsage.pendingInvites;
        if (seats < reservedSeats) {
            return NextResponse.json(
                {
                    error: 'Seat quantity too low',
                    message: `Your workspace already reserves ${reservedSeats} seats across members and pending invitations.`,
                },
                { status: 400 }
            );
        }

        const accountIsPro = account.subscription_status === 'pro';
        if (accountIsPro) {
            if (!STRIPE_PRO_PRICE_ID || !account.stripe_customer_id || !account.subscription_id) {
                return NextResponse.json(
                    {
                        error: 'Subscription requires support',
                        message: 'Your Pro billing record is incomplete. Contact support before starting Teams.',
                    },
                    { status: 409 }
                );
            }

            if (
                organization.stripe_customer_id &&
                organization.stripe_customer_id !== account.stripe_customer_id
            ) {
                return NextResponse.json(
                    {
                        error: 'Subscription requires support',
                        message: 'This workspace has separate billing history. Contact support before converting Pro to Teams.',
                    },
                    { status: 409 }
                );
            }

            if (
                organization.subscription_id &&
                organization.subscription_id !== account.subscription_id
            ) {
                return NextResponse.json(
                    {
                        error: 'Subscription requires support',
                        message: 'This workspace has separate billing history. Contact support before converting Pro to Teams.',
                    },
                    { status: 409 }
                );
            }

            const subscription = await stripe.subscriptions.retrieve(account.subscription_id);
            const subscriptionCustomerId = getStripeId(subscription.customer);
            const items = subscription.items.data;
            const proItem = items.find((item) => item.price.id === STRIPE_PRO_PRICE_ID);
            const subscriptionIsPaid = subscription.status === 'active' || subscription.status === 'trialing';

            if (
                subscription.id !== account.subscription_id ||
                subscriptionCustomerId !== account.stripe_customer_id ||
                !subscriptionIsPaid ||
                items.length !== 1 ||
                !proItem
            ) {
                return NextResponse.json(
                    {
                        error: 'Subscription requires support',
                        message: 'Your current Stripe subscription could not be safely converted automatically.',
                    },
                    { status: 409 }
                );
            }

            const convertedSubscription = await stripe.subscriptions.update(
                subscription.id,
                {
                    items: [{
                        id: proItem.id,
                        price: STRIPE_TEAMS_PRICE_ID,
                        quantity: seats,
                    }],
                    proration_behavior: 'create_prorations',
                    metadata: {
                        billing_scope: 'organization',
                        organization_id: organizationId,
                        converted_from_account_id: account.id,
                    },
                },
                {
                    idempotencyKey: `pro-to-team-${organizationId}-${subscription.id}-${seats}`,
                }
            );

            const convertedCustomerId = getStripeId(convertedSubscription.customer);
            const convertedTeamItem = convertedSubscription.items.data.find(
                (item) => item.price.id === STRIPE_TEAMS_PRICE_ID
            );
            if (
                !convertedCustomerId ||
                convertedCustomerId !== account.stripe_customer_id ||
                !convertedTeamItem ||
                convertedTeamItem.quantity !== seats
            ) {
                throw new Error('Stripe returned an unexpected Teams subscription state');
            }

            const transfer = await transferAccountSubscriptionToOrganization({
                accountId: account.id,
                organizationId,
                stripeCustomerId: convertedCustomerId,
                subscriptionId: convertedSubscription.id,
                subscriptionEndsAt: getSubscriptionEndsAt(convertedSubscription),
                seatQuantity: seats,
            });

            try {
                await stripe.customers.update(convertedCustomerId, {
                    name: (organization.name as string) || undefined,
                    metadata: {
                        account_id: '',
                        billing_scope: 'organization',
                        organization_id: organizationId,
                    },
                });
            } catch (metadataError) {
                console.error('Failed to refresh converted Teams customer metadata:', metadataError);
            }

            const successUrl = '/dashboard/settings?tab=billing&team_checkout=success';
            if (!transfer) {
                return NextResponse.json({
                    converted: true,
                    pendingSync: true,
                    url: successUrl,
                }, { status: 202 });
            }

            return NextResponse.json({ converted: true, url: successUrl });
        }

        // Get or create Stripe customer for the organization
        let stripeCustomerId = organization.stripe_customer_id as string | null;
        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: user.primaryEmail || undefined,
                name: (organization.name as string) || undefined,
                metadata: {
                    billing_scope: 'organization',
                    organization_id: organizationId,
                },
            }, {
                idempotencyKey: `organization-stripe-customer-${organizationId}`,
            });
            stripeCustomerId = customer.id;
            await updateOrganizationStripeCustomer(organizationId, stripeCustomerId);
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            mode: 'subscription',
            line_items: [
                {
                    price: STRIPE_TEAMS_PRICE_ID,
                    quantity: seats,
                },
            ],
            success_url: `${baseUrl}/dashboard/settings?tab=billing&team_checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/dashboard/settings?tab=billing&team_checkout=cancel`,
            metadata: {
                organization_id: organizationId,
                seats: String(seats),
            },
            subscription_data: {
                metadata: {
                    billing_scope: 'organization',
                    organization_id: organizationId,
                },
            },
        });

        return NextResponse.json({ url: session.url });
    } catch (error) {
        console.error('Error creating Teams checkout session:', error);
        return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }
}

