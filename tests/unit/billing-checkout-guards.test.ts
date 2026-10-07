import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    createCustomer: vi.fn(),
    createSession: vi.fn(),
    getOrCreateAccount: vi.fn(),
    getOrganizationById: vi.fn(),
    getOrganizationMemberRole: vi.fn(),
    getUser: vi.fn(),
    listSubscriptions: vi.fn(),
    qualifiesForReferralTrial: vi.fn(),
    updateAccountStripeCustomer: vi.fn(),
}));

vi.mock('@/lib/stripe/client', () => ({
    stripe: {
        customers: { create: mocks.createCustomer },
        checkout: { sessions: { create: mocks.createSession } },
        subscriptions: { list: mocks.listSubscriptions },
    },
    STRIPE_PRO_PRICE_ID: 'price_pro',
}));

vi.mock('@/lib/stack/server', () => ({
    stackServerApp: { getUser: mocks.getUser },
}));

vi.mock('@/lib/neon/queries', () => ({
    getOrCreateAccount: mocks.getOrCreateAccount,
    getOrganizationById: mocks.getOrganizationById,
    getOrganizationMemberRole: mocks.getOrganizationMemberRole,
    updateAccountStripeCustomer: mocks.updateAccountStripeCustomer,
}));

vi.mock('@/lib/referrals/referral-trial', () => ({
    qualifiesForReferralTrial: mocks.qualifiesForReferralTrial,
}));

import { POST } from '@/app/api/billing/checkout/route';

const freeAccount = {
    id: 'account_1',
    stripe_customer_id: 'cus_existing',
    subscription_status: 'free',
    active_organization_id: 'org_1',
};

describe('POST /api/billing/checkout existing-subscription guards', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.utility-sheet.test');
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        mocks.getUser.mockResolvedValue({ id: 'user_1', primaryEmail: 'buyer@example.com', displayName: 'Buyer' });
        mocks.getOrCreateAccount.mockResolvedValue(freeAccount);
        mocks.getOrganizationMemberRole.mockResolvedValue('admin');
        mocks.getOrganizationById.mockResolvedValue({ id: 'org_1', subscription_status: 'free' });
        mocks.listSubscriptions.mockResolvedValue({ data: [] });
        mocks.qualifiesForReferralTrial.mockResolvedValue(false);
        mocks.createSession.mockResolvedValue({ url: 'https://checkout.stripe.test/session' });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
    });

    it('starts checkout for a Free account with no live subscription', async () => {
        mocks.listSubscriptions.mockResolvedValue({
            data: [{ id: 'sub_old', status: 'canceled' }, { id: 'sub_abandoned', status: 'incomplete_expired' }],
        });

        const response = await POST();

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ url: 'https://checkout.stripe.test/session' });
        expect(mocks.listSubscriptions).toHaveBeenCalledWith({ customer: 'cus_existing', status: 'all', limit: 100 });
        expect(mocks.createSession).toHaveBeenCalledTimes(1);
    });

    it('refuses an account that is already Pro without calling Stripe', async () => {
        mocks.getOrCreateAccount.mockResolvedValue({ ...freeAccount, subscription_status: 'pro', subscription_id: 'sub_pro' });

        const response = await POST();

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            error: 'Already subscribed',
            message: 'This account is already on Pro. Use Manage subscription to change the plan.',
        });
        expect(mocks.listSubscriptions).not.toHaveBeenCalled();
        expect(mocks.createCustomer).not.toHaveBeenCalled();
        expect(mocks.createSession).not.toHaveBeenCalled();
    });

    it('refuses when the active workspace is on Teams', async () => {
        mocks.getOrganizationById.mockResolvedValue({ id: 'org_1', subscription_status: 'team' });
        mocks.getOrganizationMemberRole.mockResolvedValue('member');

        const response = await POST();

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({ error: 'Workspace already subscribed' });
        expect(mocks.getOrganizationMemberRole).toHaveBeenCalledWith('org_1', 'account_1');
        expect(mocks.createCustomer).not.toHaveBeenCalled();
        expect(mocks.listSubscriptions).not.toHaveBeenCalled();
        expect(mocks.createSession).not.toHaveBeenCalled();
    });

    it('does not treat a Teams workspace the account is not a member of as its plan', async () => {
        mocks.getOrganizationById.mockResolvedValue({ id: 'org_1', subscription_status: 'team' });
        mocks.getOrganizationMemberRole.mockResolvedValue(null);

        const response = await POST();

        expect(response.status).toBe(200);
        expect(mocks.createSession).toHaveBeenCalledTimes(1);
    });

    it.each(['active', 'trialing', 'paused'])(
        'refuses when Stripe already has a %s subscription our record does not show',
        async (status) => {
            mocks.listSubscriptions.mockResolvedValue({ data: [{ id: 'sub_live', status }] });

            const response = await POST();

            expect(response.status).toBe(409);
            await expect(response.json()).resolves.toEqual({
                error: 'Existing subscription',
                message: 'This account already has a subscription. It can take a minute to show here. Use Manage subscription to change it.',
                manageBilling: true,
            });
            expect(mocks.qualifiesForReferralTrial).not.toHaveBeenCalled();
            expect(mocks.createSession).not.toHaveBeenCalled();
        }
    );

    it.each(['past_due', 'unpaid'])(
        'sends a customer with a %s subscription to fix the payment instead of buying again',
        async (status) => {
            mocks.listSubscriptions.mockResolvedValue({
                data: [{ id: 'sub_old', status: 'canceled' }, { id: 'sub_late', status }],
            });

            const response = await POST();

            expect(response.status).toBe(409);
            await expect(response.json()).resolves.toEqual({
                error: 'Existing subscription',
                message: 'Your subscription has a payment that did not go through. Update your card in Manage subscription instead of starting a new one.',
                manageBilling: true,
            });
            expect(mocks.createSession).not.toHaveBeenCalled();
        }
    );

    it('still allows checkout while an earlier first payment is incomplete', async () => {
        mocks.listSubscriptions.mockResolvedValue({ data: [{ id: 'sub_incomplete', status: 'incomplete' }] });

        const response = await POST();

        expect(response.status).toBe(200);
        expect(mocks.createSession).toHaveBeenCalledTimes(1);
    });

    it('refuses checkout when Stripe cannot be asked', async () => {
        mocks.listSubscriptions.mockRejectedValue(new Error('Stripe unavailable'));

        const response = await POST();

        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toEqual({
            error: 'Billing check unavailable',
            message: 'We could not check your billing with Stripe, so checkout was not started. Try again in a minute.',
        });
        expect(mocks.qualifiesForReferralTrial).not.toHaveBeenCalled();
        expect(mocks.createSession).not.toHaveBeenCalled();
    });

    it('checks the newly created customer before starting checkout', async () => {
        mocks.getOrCreateAccount.mockResolvedValue({ ...freeAccount, stripe_customer_id: null, active_organization_id: null });
        mocks.createCustomer.mockResolvedValue({ id: 'cus_new' });

        const response = await POST();

        expect(response.status).toBe(200);
        expect(mocks.getOrganizationById).not.toHaveBeenCalled();
        expect(mocks.listSubscriptions).toHaveBeenCalledWith({ customer: 'cus_new', status: 'all', limit: 100 });
        expect(mocks.listSubscriptions.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.createSession.mock.invocationCallOrder[0]
        );
    });
});
