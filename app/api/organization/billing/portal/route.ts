import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import { stackServerApp } from '@/lib/stack/server';
import { getOrCreateAccount, getOrganizationById, getOrganizationMemberRole } from '@/lib/neon/queries';

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

        const stripeCustomerId = organization.stripe_customer_id as string | null;
        if (!stripeCustomerId) {
            return NextResponse.json({ error: 'No billing customer found for organization' }, { status: 400 });
        }

        const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/settings?tab=billing`;

        const session = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID_TEAMS || undefined,
            return_url: returnUrl,
        });

        return NextResponse.json({ url: session.url });
    } catch (error) {
        console.error('Error creating Teams billing portal session:', error);
        return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 });
    }
}
