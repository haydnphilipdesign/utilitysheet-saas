import { NextResponse } from 'next/server';
import { stripe, STRIPE_TEAMS_PRICE_ID } from '@/lib/stripe/client';
import { stackServerApp } from '@/lib/stack/server';
import {
    getOrCreateAccount,
    getOrganizationById,
    getOrganizationMemberRole,
    getOrganizationSeatUsage,
    updateOrganizationStripeCustomer,
} from '@/lib/neon/queries';

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
        if (seats < seatUsage.used) {
            return NextResponse.json(
                { error: 'Seat quantity too low', message: `Your org already has ${seatUsage.used} members.` },
                { status: 400 }
            );
        }

        // Get or create Stripe customer for the organization
        let stripeCustomerId = organization.stripe_customer_id as string | null;
        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: user.primaryEmail || undefined,
                name: (organization.name as string) || undefined,
                metadata: {
                    organization_id: organizationId,
                },
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
        });

        return NextResponse.json({ url: session.url });
    } catch (error) {
        console.error('Error creating Teams checkout session:', error);
        return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }
}

