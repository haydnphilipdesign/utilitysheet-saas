import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import { stackServerApp } from '@/lib/stack/server';
import { getOrCreateAccount } from '@/lib/neon/queries';

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

        if (!account.stripe_customer_id) {
            return NextResponse.json({ error: 'No billing account found' }, { status: 400 });
        }

        // Create billing portal session
        const session = await stripe.billingPortal.sessions.create({
            customer: account.stripe_customer_id,
            return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/settings`,
        });

        return NextResponse.json({ url: session.url });
    } catch (error) {
        console.error('Error creating portal session:', error);
        return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 });
    }
}
