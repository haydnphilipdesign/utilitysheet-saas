import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getOrCreateAccount: vi.fn(),
    getOrganizationById: vi.fn(),
    getOrganizationMemberRole: vi.fn(),
    getOrganizationSeatUsage: vi.fn(),
    getUser: vi.fn(),
    setSeats: vi.fn(),
    subscriptionRetrieve: vi.fn(),
    subscriptionUpdate: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/stripe/client', () => ({
    STRIPE_TEAMS_PRICE_ID: 'price_team',
    stripe: {
        subscriptions: {
            retrieve: mocks.subscriptionRetrieve,
            update: mocks.subscriptionUpdate,
        },
    },
}));

vi.mock('@/lib/stack/server', () => ({ stackServerApp: { getUser: mocks.getUser } }));

vi.mock('@/lib/neon/queries', () => ({
    getOrCreateAccount: mocks.getOrCreateAccount,
    getOrganizationById: mocks.getOrganizationById,
    getOrganizationMemberRole: mocks.getOrganizationMemberRole,
    getOrganizationSeatUsage: mocks.getOrganizationSeatUsage,
    setOrganizationSeatQuantityWithUsageGuard: mocks.setSeats,
}));

import { POST } from '@/app/api/organization/billing/seats/route';

function request(body: unknown = { seats: 5 }) {
    return new Request('http://localhost/api/organization/billing/seats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

function subscription(quantity = 4, overrides: Record<string, unknown> = {}) {
    return {
        id: 'sub_team',
        customer: 'cus_team',
        status: 'active',
        items: { data: [{ id: 'si_team', price: { id: 'price_team' }, quantity }] },
        ...overrides,
    };
}

/** The order the stored count and Stripe were written in. */
function writeOrder() {
    const calls = [
        ...mocks.setSeats.mock.invocationCallOrder.map((order, index) => ({
            order,
            what: `db:${mocks.setSeats.mock.calls[index][0].seats}`,
        })),
        ...mocks.subscriptionUpdate.mock.invocationCallOrder.map((order) => ({ order, what: 'stripe' })),
    ];
    return calls.sort((a, b) => a.order - b.order).map((call) => call.what);
}

describe('POST /api/organization/billing/seats', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.stubEnv('TEAM_MIN_SEATS', '3');
        mocks.getUser.mockResolvedValue({ id: 'user_1', primaryEmail: 'admin@example.com' });
        mocks.getOrCreateAccount.mockResolvedValue({ id: 'acct_1', active_organization_id: 'org_1' });
        mocks.getOrganizationMemberRole.mockResolvedValue('admin');
        mocks.getOrganizationById.mockResolvedValue({
            id: 'org_1',
            subscription_status: 'team',
            subscription_id: 'sub_team',
            stripe_customer_id: 'cus_team',
            seat_quantity: 4,
        });
        mocks.getOrganizationSeatUsage.mockResolvedValue({ used: 2, pendingInvites: 1 });
        mocks.subscriptionRetrieve.mockResolvedValue(subscription(4));
        mocks.subscriptionUpdate.mockImplementation(async (_id: string, params: { items: Array<{ quantity: number }> }) =>
            subscription(params.items[0].quantity));
        mocks.setSeats.mockImplementation(async ({ seats }: { seats: number }) => ({ status: 'updated', seatQuantity: seats }));
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
    });

    it('requires sign-in and a workspace admin, and takes the workspace from the account', async () => {
        mocks.getUser.mockResolvedValueOnce(null);
        expect((await POST(request())).status).toBe(401);

        mocks.getOrganizationMemberRole.mockResolvedValueOnce('member');
        expect((await POST(request())).status).toBe(403);

        // A workspace named in the body is not a recognized field.
        expect((await POST(request({ seats: 5, organizationId: 'org_other' }))).status).toBe(400);

        expect(mocks.subscriptionRetrieve).not.toHaveBeenCalled();
        expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
        expect(mocks.setSeats).not.toHaveBeenCalled();
    });

    it.each([
        [{ seats: 2 }, 'Teams starts at 3 seats.'],
        [{ seats: 4.5 }, 'Enter a whole number of seats.'],
        [{ seats: '5' }, 'Enter a whole number of seats.'],
        [{}, 'Enter a whole number of seats.'],
        [{ seats: 501 }, 'Enter a whole number of seats.'],
    ])('refuses %j before asking Stripe', async (body, message) => {
        const response = await POST(request(body));

        expect(response.status).toBe(400);
        expect((await response.json()).message).toBe(message);
        expect(mocks.subscriptionRetrieve).not.toHaveBeenCalled();
    });

    it('refuses fewer seats than members and pending invitations use', async () => {
        mocks.getOrganizationSeatUsage.mockResolvedValue({ used: 3, pendingInvites: 1 });

        const response = await POST(request({ seats: 3 }));

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ error: 'Seat quantity too low', reservedSeats: 4 });
        expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
        expect(mocks.setSeats).not.toHaveBeenCalled();
    });

    it('refuses a workspace that is not on Teams', async () => {
        mocks.getOrganizationById.mockResolvedValue({ id: 'org_1', subscription_status: 'free', subscription_id: null, stripe_customer_id: 'cus_team' });

        expect((await POST(request())).status).toBe(409);
        expect(mocks.subscriptionRetrieve).not.toHaveBeenCalled();
    });

    it.each([
        ['another customer’s subscription', subscription(4, { customer: 'cus_other' })],
        ['a subscription with a second item', { ...subscription(4), items: { data: [{ id: 'si_team', price: { id: 'price_team' }, quantity: 4 }, { id: 'si_x', price: { id: 'price_x' }, quantity: 1 }] } }],
        ['a subscription without the Teams price', { ...subscription(4), items: { data: [{ id: 'si_pro', price: { id: 'price_pro' }, quantity: 1 }] } }],
    ])('refuses %s without changing anything', async (_label, found) => {
        mocks.subscriptionRetrieve.mockResolvedValue(found);

        const response = await POST(request());

        expect(response.status).toBe(409);
        expect((await response.json()).error).toBe('Subscription requires support');
        expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
        expect(mocks.setSeats).not.toHaveBeenCalled();
    });

    it('sends a past-due workspace to its billing page instead of changing seats', async () => {
        mocks.subscriptionRetrieve.mockResolvedValue(subscription(4, { status: 'past_due' }));

        const response = await POST(request());

        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({ error: 'Subscription not active', manageBilling: 'workspace' });
        expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
    });

    it('adds seats in Stripe first, with prorations on the next invoice, then records them', async () => {
        const response = await POST(request({ seats: 6 }));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ seatQuantity: 6, previousSeatQuantity: 4 });
        expect(mocks.subscriptionUpdate).toHaveBeenCalledTimes(1);
        // Exactly these arguments: the same subscription item, and no idempotency key.
        expect(mocks.subscriptionUpdate).toHaveBeenCalledWith('sub_team', {
            items: [{ id: 'si_team', quantity: 6 }],
            proration_behavior: 'create_prorations',
        });
        expect(mocks.setSeats).toHaveBeenCalledWith({ organizationId: 'org_1', subscriptionId: 'sub_team', seats: 6 });
        expect(writeOrder()).toEqual(['stripe', 'db:6']);
    });

    it('removes seats from the workspace first, under the seats-in-use guard, then from Stripe', async () => {
        mocks.subscriptionRetrieve.mockResolvedValue(subscription(6));
        mocks.getOrganizationById.mockResolvedValue({
            id: 'org_1', subscription_status: 'team', subscription_id: 'sub_team', stripe_customer_id: 'cus_team', seat_quantity: 6,
        });

        const response = await POST(request({ seats: 4 }));

        expect(response.status).toBe(200);
        expect(writeOrder()).toEqual(['db:4', 'stripe']);
        expect(mocks.subscriptionUpdate).toHaveBeenCalledWith('sub_team', expect.objectContaining({
            items: [{ id: 'si_team', quantity: 4 }],
        }));
    });

    it('does not touch Stripe when an invitation took the seat a moment earlier', async () => {
        mocks.subscriptionRetrieve.mockResolvedValue(subscription(6));
        mocks.setSeats.mockResolvedValue({ status: 'in_use', reserved: 5 });

        const response = await POST(request({ seats: 4 }));

        expect(response.status).toBe(400);
        expect((await response.json()).reservedSeats).toBe(5);
        expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
    });

    it('gives the seats back when Stripe refuses a reduction', async () => {
        mocks.subscriptionRetrieve.mockResolvedValue(subscription(6));
        mocks.getOrganizationById.mockResolvedValue({
            id: 'org_1', subscription_status: 'team', subscription_id: 'sub_team', stripe_customer_id: 'cus_team', seat_quantity: 6,
        });
        mocks.subscriptionUpdate.mockRejectedValue(new Error('Stripe unavailable'));

        const response = await POST(request({ seats: 4 }));

        expect(response.status).toBe(502);
        expect((await response.json()).message).toBe('Stripe could not change your seats, so nothing was changed. Try again in a minute.');
        expect(writeOrder()).toEqual(['db:4', 'stripe', 'db:6']);
    });

    it('records nothing when Stripe refuses an increase', async () => {
        mocks.subscriptionUpdate.mockRejectedValue(new Error('Stripe unavailable'));

        const response = await POST(request({ seats: 6 }));

        expect(response.status).toBe(502);
        expect(mocks.setSeats).not.toHaveBeenCalled();
    });

    it('treats a Stripe answer with the wrong quantity as a failure', async () => {
        mocks.subscriptionUpdate.mockResolvedValue(subscription(4));

        expect((await POST(request({ seats: 6 }))).status).toBe(502);
        expect(mocks.setSeats).not.toHaveBeenCalled();
    });

    it('does not call Stripe when the quantity is already what was asked for, and repairs a stored count', async () => {
        mocks.getOrganizationById.mockResolvedValue({
            id: 'org_1', subscription_status: 'team', subscription_id: 'sub_team', stripe_customer_id: 'cus_team', seat_quantity: 3,
        });

        const response = await POST(request({ seats: 4 }));

        expect(response.status).toBe(200);
        expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
        expect(writeOrder()).toEqual(['db:4']);
    });
});
