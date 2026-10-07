import { NextResponse } from 'next/server';
import { stripe, STRIPE_PRO_PRICE_ID } from '@/lib/stripe/client';
import { stackServerApp } from '@/lib/stack/server';
import {
    getOrCreateAccount,
    getOrganizationById,
    getOrganizationMemberRole,
    updateAccountStripeCustomer,
} from '@/lib/neon/queries';
import { qualifiesForReferralTrial } from '@/lib/referrals/referral-trial';
import { findLiveSubscription } from '@/lib/stripe/subscriptions';

export async function POST() {
    try {
        if (!stripe) {
            return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
        }

        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const account = await getOrCreateAccount(user.id, user.primaryEmail || '', user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        if (account.subscription_status === 'pro') {
            return NextResponse.json(
                {
                    error: 'Already subscribed',
                    message: 'This account is already on Pro. Use Manage subscription to change the plan.',
                },
                { status: 409 }
            );
        }

        // Teams already includes Pro for everyone in the workspace.
        const organizationId = account.active_organization_id as string | null;
        if (organizationId) {
            const [role, organization] = await Promise.all([
                getOrganizationMemberRole(organizationId, account.id),
                getOrganizationById(organizationId),
            ]);
            if (role && organization?.subscription_status === 'team') {
                return NextResponse.json(
                    {
                        error: 'Workspace already subscribed',
                        message: 'This workspace is on Teams, which already includes everything in Pro.',
                    },
                    { status: 409 }
                );
            }
        }

        // Get or create Stripe customer
        let stripeCustomerId = account.stripe_customer_id;

        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: user.primaryEmail || undefined,
                name: user.displayName || undefined,
                metadata: {
                    account_id: account.id,
                },
            }, {
                idempotencyKey: `account-stripe-customer-${account.id}`,
            });
            stripeCustomerId = customer.id;
            await updateAccountStripeCustomer(account.id, stripeCustomerId);
        }

        // Our own record trails Stripe (webhook delay) and stores a past-due Pro as Free,
        // so Stripe is asked directly before a second subscription can be started.
        let liveSubscription;
        try {
            liveSubscription = await findLiveSubscription(stripeCustomerId);
        } catch (error) {
            console.error('Error checking existing subscriptions before checkout:', error);
            return NextResponse.json(
                {
                    error: 'Billing check unavailable',
                    message: 'We could not check your billing with Stripe, so checkout was not started. Try again in a minute.',
                },
                { status: 503 }
            );
        }
        if (liveSubscription) {
            const paymentProblem = liveSubscription.status === 'past_due' || liveSubscription.status === 'unpaid';
            return NextResponse.json(
                {
                    error: 'Existing subscription',
                    message: paymentProblem
                        ? 'Your subscription has a payment that did not go through. Update your card in Manage subscription instead of starting a new one.'
                        : 'This account already has a subscription. It can take a minute to show here. Use Manage subscription to change it.',
                    manageBilling: true,
                },
                { status: 409 }
            );
        }

        const qualifiesForTrial = await qualifiesForReferralTrial(account.id, stripeCustomerId);
        const referralTrialOptions = qualifiesForTrial
            ? {
                payment_method_collection: 'if_required' as const,
            }
            : {};

        const checkoutSessionParams = {
            customer: stripeCustomerId,
            mode: 'subscription' as const,
            line_items: [
                {
                    price: STRIPE_PRO_PRICE_ID,
                    quantity: 1,
                },
            ],
            success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/settings?tab=billing&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/settings?tab=billing`,
            metadata: {
                account_id: account.id,
            },
            subscription_data: {
                metadata: {
                    billing_scope: 'account',
                    account_id: account.id,
                },
                ...(qualifiesForTrial ? {
                    trial_period_days: 30,
                    trial_settings: {
                        end_behavior: { missing_payment_method: 'cancel' as const },
                    },
                } : {}),
            },
            ...referralTrialOptions,
        };

        // Stripe collapses concurrent/retried trial starts within its idempotency window;
        // after that window expires, an abandoned checkout can be replaced by a fresh session.
        const session = qualifiesForTrial
            ? await stripe.checkout.sessions.create(checkoutSessionParams, {
                idempotencyKey: `referral-trial-checkout-${account.id}-${STRIPE_PRO_PRICE_ID}`,
            })
            : await stripe.checkout.sessions.create(checkoutSessionParams);

        return NextResponse.json({ url: session.url });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }
}
