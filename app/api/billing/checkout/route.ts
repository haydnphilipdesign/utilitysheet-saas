import { NextResponse } from 'next/server';
import { stripe, STRIPE_PRO_PRICE_ID } from '@/lib/stripe/client';
import { stackServerApp } from '@/lib/stack/server';
import { getOrCreateAccount, updateAccountStripeCustomer } from '@/lib/neon/queries';

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
            });
            stripeCustomerId = customer.id;
            await updateAccountStripeCustomer(account.id, stripeCustomerId);
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            mode: 'subscription',
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
        });

        return NextResponse.json({ url: session.url });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }
}
