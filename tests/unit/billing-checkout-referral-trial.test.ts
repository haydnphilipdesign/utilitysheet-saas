import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.utility-sheet.test');
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

    afterEach(() => {
        vi.unstubAllEnvs();
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
        expect(mocks.createSession).toHaveBeenCalledTimes(1);
        expect(mocks.createSession.mock.calls[0]).toEqual([
            {
                customer: 'cus_existing',
                mode: 'subscription',
                line_items: [{ price: 'price_pro', quantity: 1 }],
                success_url: 'https://app.utility-sheet.test/dashboard/settings?tab=billing&session_id={CHECKOUT_SESSION_ID}',
                cancel_url: 'https://app.utility-sheet.test/dashboard/settings?tab=billing',
                metadata: { account_id: 'account_referred' },
                payment_method_collection: 'if_required',
                subscription_data: {
                    metadata: {
                        billing_scope: 'account',
                        account_id: 'account_referred',
                    },
                    trial_period_days: 30,
                    trial_settings: {
                        end_behavior: { missing_payment_method: 'cancel' },
                    },
                },
            },
            {
                idempotencyKey: 'referral-trial-checkout-account_referred-price_pro',
            },
        ]);
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
        expect(mocks.createCustomer).toHaveBeenCalledWith(
            {
                email: 'buyer@example.com',
                name: 'Buyer',
                metadata: { account_id: 'account_referred' },
            },
            {
                idempotencyKey: 'account-stripe-customer-account_referred',
            }
        );
        expect(mocks.updateAccountStripeCustomer).toHaveBeenCalledWith(
            'account_referred',
            'cus_new'
        );
        expect(mocks.qualifiesForReferralTrial).toHaveBeenCalledWith(
            'account_referred',
            'cus_new'
        );

        const payload = mocks.createSession.mock.calls[0][0];
        expect(mocks.createSession).toHaveBeenCalledTimes(1);
        expect(mocks.createSession.mock.calls[0]).toHaveLength(1);
        expect(payload).toEqual({
            customer: 'cus_new',
            mode: 'subscription',
            line_items: [{ price: 'price_pro', quantity: 1 }],
            success_url: 'https://app.utility-sheet.test/dashboard/settings?tab=billing&session_id={CHECKOUT_SESSION_ID}',
            cancel_url: 'https://app.utility-sheet.test/dashboard/settings?tab=billing',
            metadata: { account_id: 'account_referred' },
            subscription_data: {
                metadata: {
                    billing_scope: 'account',
                    account_id: 'account_referred',
                },
            },
        });
    });

    it('reuses one trial session for concurrent qualified existing-customer requests', async () => {
        const sessionsByIdempotencyKey = new Map<string, { url: string }>();
        let logicalSessionCreates = 0;
        mocks.qualifiesForReferralTrial.mockResolvedValue(true);
        mocks.createSession.mockImplementation(async (_payload, options) => {
            const idempotencyKey = options?.idempotencyKey;
            if (!idempotencyKey) {
                throw new Error('Expected a Checkout Session idempotency key');
            }

            let session = sessionsByIdempotencyKey.get(idempotencyKey);
            if (!session) {
                logicalSessionCreates += 1;
                session = { url: `https://checkout.stripe.test/session-${logicalSessionCreates}` };
                sessionsByIdempotencyKey.set(idempotencyKey, session);
            }
            return session;
        });

        const responses = await Promise.all([POST(), POST()]);
        const bodies = await Promise.all(responses.map((response) => response.json()));

        expect(bodies).toEqual([
            { url: 'https://checkout.stripe.test/session-1' },
            { url: 'https://checkout.stripe.test/session-1' },
        ]);
        expect(logicalSessionCreates).toBe(1);
        expect(mocks.createSession).toHaveBeenCalledTimes(2);
        expect(mocks.createSession.mock.calls.map((call) => call[1])).toEqual([
            { idempotencyKey: 'referral-trial-checkout-account_referred-price_pro' },
            { idempotencyKey: 'referral-trial-checkout-account_referred-price_pro' },
        ]);
    });

    it('reuses one customer and trial session for concurrent qualified new-customer requests', async () => {
        const customersByIdempotencyKey = new Map<string, { id: string }>();
        const sessionsByIdempotencyKey = new Map<string, { url: string }>();
        let logicalCustomerCreates = 0;
        let logicalSessionCreates = 0;
        mocks.getOrCreateAccount.mockResolvedValue({
            id: 'account_referred',
            stripe_customer_id: null,
        });
        mocks.qualifiesForReferralTrial.mockResolvedValue(true);
        mocks.createCustomer.mockImplementation(async (_params, options) => {
            const idempotencyKey = options?.idempotencyKey;
            if (!idempotencyKey) {
                throw new Error('Expected a Customer idempotency key');
            }

            let customer = customersByIdempotencyKey.get(idempotencyKey);
            if (!customer) {
                logicalCustomerCreates += 1;
                customer = { id: `cus_new_${logicalCustomerCreates}` };
                customersByIdempotencyKey.set(idempotencyKey, customer);
            }
            return customer;
        });
        mocks.createSession.mockImplementation(async (_payload, options) => {
            const idempotencyKey = options?.idempotencyKey;
            if (!idempotencyKey) {
                throw new Error('Expected a Checkout Session idempotency key');
            }

            let session = sessionsByIdempotencyKey.get(idempotencyKey);
            if (!session) {
                logicalSessionCreates += 1;
                session = { url: `https://checkout.stripe.test/session-${logicalSessionCreates}` };
                sessionsByIdempotencyKey.set(idempotencyKey, session);
            }
            return session;
        });

        const responses = await Promise.all([POST(), POST()]);
        const bodies = await Promise.all(responses.map((response) => response.json()));

        expect(bodies).toEqual([
            { url: 'https://checkout.stripe.test/session-1' },
            { url: 'https://checkout.stripe.test/session-1' },
        ]);
        expect(logicalCustomerCreates).toBe(1);
        expect(logicalSessionCreates).toBe(1);
        expect(mocks.createCustomer).toHaveBeenCalledTimes(2);
        expect(mocks.createCustomer.mock.calls.map((call) => call[1])).toEqual([
            { idempotencyKey: 'account-stripe-customer-account_referred' },
            { idempotencyKey: 'account-stripe-customer-account_referred' },
        ]);
        expect(mocks.updateAccountStripeCustomer).toHaveBeenCalledTimes(2);
        expect(mocks.updateAccountStripeCustomer).toHaveBeenNthCalledWith(
            1,
            'account_referred',
            'cus_new_1'
        );
        expect(mocks.updateAccountStripeCustomer).toHaveBeenNthCalledWith(
            2,
            'account_referred',
            'cus_new_1'
        );
        expect(mocks.createSession.mock.calls.map((call) => call[1])).toEqual([
            { idempotencyKey: 'referral-trial-checkout-account_referred-price_pro' },
            { idempotencyKey: 'referral-trial-checkout-account_referred-price_pro' },
        ]);
    });

    it('omits trial fields and a stable session key when prior history is unqualified', async () => {
        mocks.qualifiesForReferralTrial.mockResolvedValue(false);

        await POST();

        expect(mocks.createSession).toHaveBeenCalledTimes(1);
        expect(mocks.createSession.mock.calls[0]).toHaveLength(1);
        expect(mocks.createSession.mock.calls[0][0]).not.toHaveProperty('payment_method_collection');
        expect(mocks.createSession.mock.calls[0][0].subscription_data).toEqual({
            metadata: {
                billing_scope: 'account',
                account_id: 'account_referred',
            },
        });
    });
});
