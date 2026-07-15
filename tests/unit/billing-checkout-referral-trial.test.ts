import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    createCustomer: vi.fn(),
    createSession: vi.fn(),
    getOrCreateAccount: vi.fn(),
    getUser: vi.fn(),
    qualifiesForReferralTrial: vi.fn(),
    updateAccountStripeCustomer: vi.fn(),
}));

vi.mock('@/lib/stripe/client', () => ({
    stripe: {
        customers: { create: mocks.createCustomer },
        checkout: { sessions: { create: mocks.createSession } },
    },
    STRIPE_PRO_PRICE_ID: 'price_pro',
}));

vi.mock('@/lib/stack/server', () => ({
    stackServerApp: { getUser: mocks.getUser },
}));

vi.mock('@/lib/neon/queries', () => ({
    getOrCreateAccount: mocks.getOrCreateAccount,
    updateAccountStripeCustomer: mocks.updateAccountStripeCustomer,
}));

vi.mock('@/lib/referrals/referral-trial', () => ({
    qualifiesForReferralTrial: mocks.qualifiesForReferralTrial,
}));

import { POST } from '@/app/api/billing/checkout/route';

describe('POST /api/billing/checkout referral trial', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUser.mockResolvedValue({
            id: 'user_1',
            primaryEmail: 'buyer@example.com',
            displayName: 'Buyer',
        });
        mocks.getOrCreateAccount.mockResolvedValue({
            id: 'account_referred',
            stripe_customer_id: 'cus_existing',
        });
        mocks.qualifiesForReferralTrial.mockResolvedValue(false);
        mocks.createSession.mockResolvedValue({ url: 'https://checkout.stripe.test/session' });
    });

    it('adds the exact referral trial settings for a qualified existing customer', async () => {
        mocks.qualifiesForReferralTrial.mockResolvedValue(true);

        const response = await POST();

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            url: 'https://checkout.stripe.test/session',
        });
        expect(mocks.qualifiesForReferralTrial).toHaveBeenCalledWith(
            'account_referred',
            'cus_existing'
        );
        expect(mocks.createSession).toHaveBeenCalledWith(expect.objectContaining({
            customer: 'cus_existing',
            payment_method_collection: 'if_required',
            subscription_data: {
                trial_period_days: 30,
                trial_settings: {
                    end_behavior: { missing_payment_method: 'cancel' },
                },
            },
        }));
    });

    it('creates a customer and omits all trial fields when the account is not qualified', async () => {
        mocks.getOrCreateAccount.mockResolvedValue({
            id: 'account_referred',
            stripe_customer_id: null,
        });
        mocks.createCustomer.mockResolvedValue({ id: 'cus_new' });

        const response = await POST();

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            url: 'https://checkout.stripe.test/session',
        });
        expect(mocks.createCustomer).toHaveBeenCalledWith({
            email: 'buyer@example.com',
            name: 'Buyer',
            metadata: { account_id: 'account_referred' },
        });
        expect(mocks.updateAccountStripeCustomer).toHaveBeenCalledWith(
            'account_referred',
            'cus_new'
        );
        expect(mocks.qualifiesForReferralTrial).toHaveBeenCalledWith(
            'account_referred',
            'cus_new'
        );

        const payload = mocks.createSession.mock.calls[0][0];
        expect(payload).not.toHaveProperty('payment_method_collection');
        expect(payload).not.toHaveProperty('subscription_data');
        expect(payload).toMatchObject({
            customer: 'cus_new',
            mode: 'subscription',
            line_items: [{ price: 'price_pro', quantity: 1 }],
            metadata: { account_id: 'account_referred' },
        });
    });
});
