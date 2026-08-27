import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    checkoutCreate: vi.fn(),
    customerCreate: vi.fn(),
    customerUpdate: vi.fn(),
    getOrganizationById: vi.fn(),
    getOrganizationMemberRole: vi.fn(),
    getOrganizationSeatUsage: vi.fn(),
    getOrCreateAccount: vi.fn(),
    getUser: vi.fn(),
    subscriptionRetrieve: vi.fn(),
    subscriptionUpdate: vi.fn(),
    transferAccountSubscriptionToOrganization: vi.fn(),
    updateOrganizationStripeCustomer: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/stripe/client', () => ({
    STRIPE_PRO_PRICE_ID: 'price_pro',
    STRIPE_TEAMS_PRICE_ID: 'price_team',
    stripe: {
        checkout: { sessions: { create: mocks.checkoutCreate } },
        customers: {
            create: mocks.customerCreate,
            update: mocks.customerUpdate,
        },
        subscriptions: {
            retrieve: mocks.subscriptionRetrieve,
            update: mocks.subscriptionUpdate,
        },
    },
}));

vi.mock('@/lib/stack/server', () => ({
    stackServerApp: { getUser: mocks.getUser },
}));

vi.mock('@/lib/neon/queries', () => ({
    getOrganizationById: mocks.getOrganizationById,
    getOrganizationMemberRole: mocks.getOrganizationMemberRole,
    getOrganizationSeatUsage: mocks.getOrganizationSeatUsage,
    getOrCreateAccount: mocks.getOrCreateAccount,
    transferAccountSubscriptionToOrganization: mocks.transferAccountSubscriptionToOrganization,
    updateOrganizationStripeCustomer: mocks.updateOrganizationStripeCustomer,
}));

import { POST } from '@/app/api/organization/billing/checkout/route';

function request(seats = 3) {
    return new Request('http://localhost/api/organization/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seats }),
    });
}

describe('POST /api/organization/billing/checkout', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.stubEnv('TEAM_MIN_SEATS', '3');
        mocks.getUser.mockResolvedValue({
            id: 'user_1',
            primaryEmail: 'owner@example.com',
            displayName: 'Owner',
        });
        mocks.getOrCreateAccount.mockResolvedValue({
            id: 'acct_1',
            active_organization_id: 'org_1',
            stripe_customer_id: null,
            subscription_status: 'free',
            subscription_id: null,
        });
        mocks.getOrganizationMemberRole.mockResolvedValue('admin');
        mocks.getOrganizationById.mockResolvedValue({
            id: 'org_1',
            name: 'Owner Workspace',
            stripe_customer_id: null,
            subscription_status: 'free',
            subscription_id: null,
        });
        mocks.getOrganizationSeatUsage.mockResolvedValue({ used: 1, pendingInvites: 0 });
        mocks.customerCreate.mockResolvedValue({ id: 'cus_team' });
        mocks.customerUpdate.mockResolvedValue({ id: 'cus_pro' });
        mocks.checkoutCreate.mockResolvedValue({ url: 'https://checkout.stripe.test/team' });
        mocks.updateOrganizationStripeCustomer.mockResolvedValue({ id: 'org_1' });
        mocks.transferAccountSubscriptionToOrganization.mockResolvedValue({
            account: { id: 'acct_1', subscription_status: 'free' },
            organization: { id: 'org_1', subscription_status: 'team' },
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('keeps Free-to-Team on Checkout and tags the created subscription for the organization', async () => {
        const response = await POST(request(4));

        expect(response.status).toBe(200);
        expect(mocks.customerCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                email: 'owner@example.com',
                metadata: expect.objectContaining({
                    billing_scope: 'organization',
                    organization_id: 'org_1',
                }),
            }),
            expect.objectContaining({ idempotencyKey: 'organization-stripe-customer-org_1' })
        );
        expect(mocks.checkoutCreate).toHaveBeenCalledWith(expect.objectContaining({
            customer: 'cus_team',
            line_items: [{ price: 'price_team', quantity: 4 }],
            metadata: expect.objectContaining({ organization_id: 'org_1' }),
            subscription_data: {
                metadata: expect.objectContaining({
                    billing_scope: 'organization',
                    organization_id: 'org_1',
                }),
            },
        }));
        expect(await response.json()).toEqual({ url: 'https://checkout.stripe.test/team' });
        expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
    });

    it('converts an active Pro subscription in place and transfers billing ownership', async () => {
        mocks.getOrCreateAccount.mockResolvedValue({
            id: 'acct_1',
            active_organization_id: 'org_1',
            stripe_customer_id: 'cus_pro',
            subscription_status: 'pro',
            subscription_id: 'sub_pro',
        });
        mocks.subscriptionRetrieve.mockResolvedValue({
            id: 'sub_pro',
            customer: 'cus_pro',
            status: 'active',
            items: {
                data: [{
                    id: 'si_pro',
                    price: { id: 'price_pro' },
                    quantity: 1,
                    current_period_end: 1_900_000_000,
                }],
            },
        });
        mocks.subscriptionUpdate.mockResolvedValue({
            id: 'sub_pro',
            customer: 'cus_pro',
            status: 'active',
            items: {
                data: [{
                    id: 'si_pro',
                    price: { id: 'price_team' },
                    quantity: 5,
                    current_period_end: 1_900_000_000,
                }],
            },
        });

        const response = await POST(request(5));

        expect(response.status).toBe(200);
        expect(mocks.checkoutCreate).not.toHaveBeenCalled();
        expect(mocks.subscriptionUpdate).toHaveBeenCalledWith(
            'sub_pro',
            expect.objectContaining({
                items: [{ id: 'si_pro', price: 'price_team', quantity: 5 }],
                proration_behavior: 'create_prorations',
                metadata: expect.objectContaining({
                    billing_scope: 'organization',
                    organization_id: 'org_1',
                    converted_from_account_id: 'acct_1',
                }),
            }),
            expect.objectContaining({
                idempotencyKey: 'pro-to-team-org_1-sub_pro-5',
            })
        );
        expect(mocks.transferAccountSubscriptionToOrganization).toHaveBeenCalledWith({
            accountId: 'acct_1',
            organizationId: 'org_1',
            stripeCustomerId: 'cus_pro',
            subscriptionId: 'sub_pro',
            subscriptionEndsAt: new Date(1_900_000_000 * 1000),
            seatQuantity: 5,
        });
        expect(await response.json()).toEqual({
            converted: true,
            url: '/dashboard/settings?tab=billing&team_checkout=success',
        });
    });

    it('rejects an unexpected Pro subscription shape without changing Stripe', async () => {
        mocks.getOrCreateAccount.mockResolvedValue({
            id: 'acct_1',
            active_organization_id: 'org_1',
            stripe_customer_id: 'cus_pro',
            subscription_status: 'pro',
            subscription_id: 'sub_pro',
        });
        mocks.subscriptionRetrieve.mockResolvedValue({
            id: 'sub_pro',
            customer: 'cus_pro',
            status: 'active',
            items: {
                data: [
                    { id: 'si_pro', price: { id: 'price_pro' }, quantity: 1 },
                    { id: 'si_other', price: { id: 'price_other' }, quantity: 1 },
                ],
            },
        });

        const response = await POST(request(3));

        expect(response.status).toBe(409);
        expect(await response.json()).toEqual(expect.objectContaining({
            error: 'Subscription requires support',
        }));
        expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
        expect(mocks.checkoutCreate).not.toHaveBeenCalled();
    });

    it('rejects a workspace that already references a different subscription before changing Stripe', async () => {
        mocks.getOrCreateAccount.mockResolvedValue({
            id: 'acct_1',
            active_organization_id: 'org_1',
            stripe_customer_id: 'cus_pro',
            subscription_status: 'pro',
            subscription_id: 'sub_pro',
        });
        mocks.getOrganizationById.mockResolvedValue({
            id: 'org_1',
            name: 'Owner Workspace',
            stripe_customer_id: 'cus_pro',
            subscription_status: 'free',
            subscription_id: 'sub_legacy_team',
        });

        const response = await POST(request(3));

        expect(response.status).toBe(409);
        expect(mocks.subscriptionRetrieve).not.toHaveBeenCalled();
        expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
        expect(mocks.transferAccountSubscriptionToOrganization).not.toHaveBeenCalled();
    });

    it('does not transfer local ownership when Stripe rejects the conversion', async () => {
        mocks.getOrCreateAccount.mockResolvedValue({
            id: 'acct_1',
            active_organization_id: 'org_1',
            stripe_customer_id: 'cus_pro',
            subscription_status: 'pro',
            subscription_id: 'sub_pro',
        });
        mocks.subscriptionRetrieve.mockResolvedValue({
            id: 'sub_pro',
            customer: 'cus_pro',
            status: 'active',
            items: {
                data: [{ id: 'si_pro', price: { id: 'price_pro' }, quantity: 1 }],
            },
        });
        mocks.subscriptionUpdate.mockRejectedValue(new Error('Stripe unavailable'));

        const response = await POST(request(3));

        expect(response.status).toBe(500);
        expect(mocks.transferAccountSubscriptionToOrganization).not.toHaveBeenCalled();
        expect(mocks.checkoutCreate).not.toHaveBeenCalled();
    });

    it('requires a workspace admin', async () => {
        mocks.getOrganizationMemberRole.mockResolvedValue('member');

        const response = await POST(request());

        expect(response.status).toBe(403);
        expect(mocks.checkoutCreate).not.toHaveBeenCalled();
        expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
    });

    it('counts pending invitations when validating the requested seat quantity', async () => {
        mocks.getOrganizationSeatUsage.mockResolvedValue({ used: 2, pendingInvites: 2 });

        const response = await POST(request(3));

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual(expect.objectContaining({
            error: 'Seat quantity too low',
        }));
        expect(mocks.checkoutCreate).not.toHaveBeenCalled();
        expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
    });
});
