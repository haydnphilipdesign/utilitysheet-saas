import { NextResponse } from 'next/server';
import { stripe, STRIPE_PRO_PRICE_ID } from '@/lib/stripe/client';
import { stackServerApp } from '@/lib/stack/server';
import { getOrCreateAccount, updateAccountStripeCustomer } from '@/lib/neon/queries';
import { qualifiesForReferralTrial } from '@/lib/referrals/referral-trial';

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

        const qualifiesForTrial = await qualifiesForReferralTrial(account.id, stripeCustomerId);
        const referralTrialOptions = qualifiesForTrial
            ? {
                payment_method_collection: 'if_required' as const,
                subscription_data: {
                    trial_period_days: 30,
                    trial_settings: {
                        end_behavior: { missing_payment_method: 'cancel' as const },
                    },
                },
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
            success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/settings?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/settings`,
            metadata: {
                account_id: account.id,
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
