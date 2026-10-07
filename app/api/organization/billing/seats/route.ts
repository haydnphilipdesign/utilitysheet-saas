import { NextResponse } from 'next/server';
import { stripe, STRIPE_TEAMS_PRICE_ID } from '@/lib/stripe/client';
import { stackServerApp } from '@/lib/stack/server';
import {
    getOrCreateAccount,
    getOrganizationById,
    getOrganizationMemberRole,
    getOrganizationSeatUsage,
    setOrganizationSeatQuantityWithUsageGuard,
} from '@/lib/neon/queries';
import { organizationSeatsBodySchema } from '@/lib/validation/schemas';

function getStripeId(value: string | { id: string } | null): string | null {
    return typeof value === 'string' ? value : value?.id || null;
}

function getMinSeats(): number {
    const raw = process.env.TEAM_MIN_SEATS;
    const parsed = raw ? Number(raw) : 3;
    return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 3;
}

function refuse(status: number, error: string, message: string, extra: Record<string, unknown> = {}) {
    return NextResponse.json({ error, message, ...extra }, { status });
}

function seatsInUseRefusal(reserved: number) {
    return refuse(
        400,
        'Seat quantity too low',
        `This workspace uses ${reserved} seats across members and pending invitations, so it needs at least ${reserved}. Remove a member or cancel an invitation first.`,
        { reservedSeats: reserved }
    );
}

/**
 * Changes how many seats a Teams workspace pays for, on its existing Stripe
 * subscription. Same rule as checkout: at least the minimum, and never fewer
 * than the seats in use. Our stored count never runs ahead of what is paid for.
 */
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

        // The workspace and the role come from the signed-in account, never from the request.
        const organizationId = account.active_organization_id as string | null;
        if (!organizationId) {
            return NextResponse.json({ error: 'No active organization' }, { status: 404 });
        }

        const role = await getOrganizationMemberRole(organizationId, account.id);
        if (role !== 'admin') {
            return NextResponse.json({ error: 'Only organization admins can manage billing' }, { status: 403 });
        }

        const parsed = organizationSeatsBodySchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
            return refuse(400, 'Invalid seat quantity', 'Enter a whole number of seats.');
        }
        const seats = parsed.data.seats;

        const minSeats = getMinSeats();
        if (seats < minSeats) {
            return refuse(400, 'Seat quantity too low', `Teams starts at ${minSeats} seats.`);
        }

        const organization = await getOrganizationById(organizationId);
        if (!organization) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const subscriptionId = organization.subscription_id as string | null;
        const stripeCustomerId = organization.stripe_customer_id as string | null;
        if (organization.subscription_status !== 'team' || !subscriptionId || !stripeCustomerId) {
            return refuse(409, 'Team plan required', 'This workspace is not on a Teams plan, so there are no seats to change.');
        }

        const seatUsage = await getOrganizationSeatUsage(organizationId);
        const reservedSeats = seatUsage.used + seatUsage.pendingInvites;
        if (seats < reservedSeats) {
            return seatsInUseRefusal(reservedSeats);
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const items = subscription.items.data;
        const teamItem = items.find((item) => item.price.id === STRIPE_TEAMS_PRICE_ID);
        if (
            subscription.id !== subscriptionId ||
            getStripeId(subscription.customer) !== stripeCustomerId ||
            items.length !== 1 ||
            !teamItem
        ) {
            return refuse(
                409,
                'Subscription requires support',
                'This workspace’s subscription could not be changed automatically. Contact support and we’ll sort it out.'
            );
        }
        if (subscription.status !== 'active' && subscription.status !== 'trialing') {
            return refuse(
                409,
                'Subscription not active',
                'The Teams subscription for this workspace has a payment that did not go through. Update the card in Manage Teams billing, then change seats.',
                { manageBilling: 'workspace' }
            );
        }

        const currentSeats = typeof teamItem.quantity === 'number' ? teamItem.quantity : 0;
        const storedSeats = Number(organization.seat_quantity) || 0;
        const lowering = seats < Math.max(currentSeats, storedSeats);

        // Lowering: take the seats away from invitations first, so nobody can
        // claim one while Stripe is being asked.
        if (lowering) {
            const reserved = await setOrganizationSeatQuantityWithUsageGuard({ organizationId, subscriptionId, seats });
            if (reserved.status === 'in_use') return seatsInUseRefusal(reserved.reserved);
            if (reserved.status !== 'updated') {
                return refuse(409, 'Team plan required', 'This workspace’s plan changed while seats were being updated. Reload and try again.');
            }
        }

        if (currentSeats !== seats) {
            try {
                // No idempotency key: setting a quantity twice is harmless, and a key
                // would make a later, identical change return a cached response unapplied.
                const updated = await stripe.subscriptions.update(subscriptionId, {
                    items: [{ id: teamItem.id, quantity: seats }],
                    proration_behavior: 'create_prorations',
                });
                const updatedItem = updated.items.data.find((item) => item.price.id === STRIPE_TEAMS_PRICE_ID);
                if (!updatedItem || updatedItem.quantity !== seats) {
                    throw new Error('Stripe returned an unexpected seat quantity');
                }
            } catch (stripeError) {
                console.error('Error changing Teams seat quantity in Stripe:', stripeError);
                if (lowering && storedSeats !== seats) {
                    // Stripe still bills the old count; give the workspace its seats back.
                    const restored = await setOrganizationSeatQuantityWithUsageGuard({
                        organizationId,
                        subscriptionId,
                        seats: storedSeats,
                    }).catch(() => null);
                    if (restored?.status !== 'updated') {
                        console.error(`Seat count for organization ${organizationId} was not restored after a failed Stripe update`);
                    }
                }
                return refuse(
                    502,
                    'Seat change failed',
                    'Stripe could not change your seats, so nothing was changed. Try again in a minute.'
                );
            }
        }

        // Raising (or repairing a stored count that trails Stripe): Stripe is
        // already charging for these seats. The webhook writes the same value.
        if (!lowering) {
            const raised = await setOrganizationSeatQuantityWithUsageGuard({ organizationId, subscriptionId, seats });
            if (raised.status !== 'updated') {
                return NextResponse.json({ seatQuantity: seats, pendingSync: true }, { status: 202 });
            }
        }

        return NextResponse.json({ seatQuantity: seats, previousSeatQuantity: currentSeats });
    } catch (error) {
        console.error('Error changing Teams seats:', error);
        return NextResponse.json({ error: 'Failed to change seats' }, { status: 500 });
    }
}
