import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const constructEvent = vi.fn();
    const retrieveSubscription = vi.fn();
    const configuredStripe = {
        webhooks: { constructEvent },
        subscriptions: { retrieve: retrieveSubscription },
    };

    return {
        applyEarnedReferralCredits: vi.fn(),
        configuredStripe,
        constructEvent,
        getAccountByStripeCustomerId: vi.fn(),
        getOrganizationByStripeCustomerId: vi.fn(),
        retrieveSubscription,
        stripe: configuredStripe as typeof configuredStripe | null,
        updateAccountSubscription: vi.fn(),
        updateOrganizationSubscription: vi.fn(),
    };
});

vi.mock('server-only', () => ({}));

vi.mock('@/lib/stripe/client', () => ({
    get stripe() {
        return mocks.stripe;
    },
    STRIPE_TEAMS_PRICE_ID: 'price_teams',
}));

vi.mock('@/lib/neon/queries', () => ({
    getAccountByStripeCustomerId: mocks.getAccountByStripeCustomerId,
    getOrganizationByStripeCustomerId: mocks.getOrganizationByStripeCustomerId,
    updateAccountSubscription: mocks.updateAccountSubscription,
    updateOrganizationSubscription: mocks.updateOrganizationSubscription,
}));

vi.mock('@/lib/referrals/referral-credit-service', () => ({
    applyEarnedReferralCredits: mocks.applyEarnedReferralCredits,
}));

import { POST } from '@/app/api/billing/webhook/route';

function makeWebhookRequest() {
    return new Request('http://localhost/api/billing/webhook', {
        method: 'POST',
        body: '{}',
        headers: { 'stripe-signature': 'test-signature' },
    });
}

const checkoutEvent = {
    type: 'checkout.session.completed',
    data: {
        object: {
            mode: 'subscription',
            customer: 'cus_checkout',
            subscription: 'sub_checkout',
        },
    },
};

const subscription = {
    id: 'sub_checkout',
    status: 'active',
    current_period_end: 1_800_000_000,
    items: {
        data: [{ price: { id: 'price_teams' }, quantity: 7 }],
    },
};

describe('POST /api/billing/webhook referral credits', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test');
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        mocks.stripe = mocks.configuredStripe;
        mocks.constructEvent.mockReturnValue(checkoutEvent);
        mocks.retrieveSubscription.mockResolvedValue(subscription);
        mocks.getAccountByStripeCustomerId.mockResolvedValue({ id: 'account_1' });
        mocks.getOrganizationByStripeCustomerId.mockResolvedValue(null);
        mocks.updateAccountSubscription.mockResolvedValue(undefined);
        mocks.updateOrganizationSubscription.mockResolvedValue(undefined);
        mocks.applyEarnedReferralCredits.mockResolvedValue(['credit_1']);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
    });

    it('updates an account subscription before redeeming its earned credits', async () => {
        const response = await POST(makeWebhookRequest());

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ received: true });
        expect(mocks.constructEvent).toHaveBeenCalledWith(
            '{}',
            'test-signature',
            'whsec_test'
        );
        expect(mocks.retrieveSubscription).toHaveBeenCalledWith('sub_checkout');
        expect(mocks.updateAccountSubscription).toHaveBeenCalledWith('account_1', {
            subscriptionStatus: 'pro',
            subscriptionId: 'sub_checkout',
            subscriptionEndsAt: new Date(1_800_000_000 * 1000),
        });
        expect(mocks.applyEarnedReferralCredits).toHaveBeenCalledWith(
            'account_1',
            { requireActiveSubscription: false }
        );
        expect(mocks.applyEarnedReferralCredits.mock.invocationCallOrder[0]).toBeGreaterThan(
            mocks.updateAccountSubscription.mock.invocationCallOrder[0]
        );
    });

    it('updates an organization Teams subscription without redeeming account credits', async () => {
        mocks.getAccountByStripeCustomerId.mockResolvedValue(null);
        mocks.getOrganizationByStripeCustomerId.mockResolvedValue({ id: 'organization_1' });

        const response = await POST(makeWebhookRequest());

        expect(response.status).toBe(200);
        expect(mocks.updateOrganizationSubscription).toHaveBeenCalledWith('organization_1', {
            subscriptionStatus: 'team',
            subscriptionId: 'sub_checkout',
            subscriptionEndsAt: new Date(1_800_000_000 * 1000),
            seatQuantity: 7,
        });
        expect(mocks.applyEarnedReferralCredits).not.toHaveBeenCalled();
    });

    it('returns 500 so Stripe retries when earned credit redemption fails', async () => {
        mocks.applyEarnedReferralCredits.mockRejectedValue(new Error('Stripe unavailable'));

        const response = await POST(makeWebhookRequest());

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({ error: 'Webhook handler failed' });
        expect(mocks.updateAccountSubscription).toHaveBeenCalledTimes(1);
        expect(mocks.applyEarnedReferralCredits).toHaveBeenCalledWith(
            'account_1',
            { requireActiveSubscription: false }
        );
    });

    it.each(['customer.subscription.updated', 'customer.subscription.deleted']) (
        'does not redeem credits for %s events',
        async (type) => {
            mocks.constructEvent.mockReturnValue({
                type,
                data: {
                    object: {
                        ...subscription,
                        customer: 'cus_checkout',
                    },
                },
            });

            const response = await POST(makeWebhookRequest());

            expect(response.status).toBe(200);
            expect(mocks.updateAccountSubscription).toHaveBeenCalledTimes(1);
            expect(mocks.applyEarnedReferralCredits).not.toHaveBeenCalled();
        }
    );
});
