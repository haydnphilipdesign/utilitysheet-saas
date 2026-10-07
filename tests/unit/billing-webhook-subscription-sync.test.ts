import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    applyEarnedReferralCredits: vi.fn(),
    constructEvent: vi.fn(),
    getAccountById: vi.fn(),
    getAccountByStripeCustomerId: vi.fn(),
    getOrganizationById: vi.fn(),
    getOrganizationByStripeCustomerId: vi.fn(),
    recordOperationalEvent: vi.fn(),
    recordOperationalSuccess: vi.fn(),
    retrieveSubscription: vi.fn(),
    transferAccountSubscriptionToOrganization: vi.fn(),
    updateAccountSubscription: vi.fn(),
    updateOrganizationSubscription: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/ops/events', () => ({
    errorNameOf: () => 'Error',
    recordOperationalEvent: mocks.recordOperationalEvent,
    recordOperationalSuccess: mocks.recordOperationalSuccess,
}));

vi.mock('@/lib/stripe/client', () => ({
    stripe: {
        webhooks: { constructEvent: mocks.constructEvent },
        subscriptions: { retrieve: mocks.retrieveSubscription },
    },
    STRIPE_TEAMS_PRICE_ID: 'price_teams',
}));

vi.mock('@/lib/neon/queries', () => ({
    getAccountById: mocks.getAccountById,
    getAccountByStripeCustomerId: mocks.getAccountByStripeCustomerId,
    getOrganizationById: mocks.getOrganizationById,
    getOrganizationByStripeCustomerId: mocks.getOrganizationByStripeCustomerId,
    transferAccountSubscriptionToOrganization: mocks.transferAccountSubscriptionToOrganization,
    updateAccountSubscription: mocks.updateAccountSubscription,
    updateOrganizationSubscription: mocks.updateOrganizationSubscription,
}));

vi.mock('@/lib/referrals/referral-credit-service', () => ({
    applyEarnedReferralCredits: mocks.applyEarnedReferralCredits,
}));

import { POST } from '@/app/api/billing/webhook/route';

const PERIOD_END = 1_800_000_000;
const CANCEL_AT = 1_800_500_000;

type SubscriptionOverrides = Record<string, unknown>;

function proSubscription(overrides: SubscriptionOverrides = {}) {
    return {
        id: 'sub_current',
        status: 'active',
        customer: 'cus_1',
        cancel_at: null,
        cancel_at_period_end: false,
        metadata: { billing_scope: 'account', account_id: 'account_1' },
        items: { data: [{ current_period_end: PERIOD_END, price: { id: 'price_pro' }, quantity: 1 }] },
        ...overrides,
    };
}

function teamSubscription(overrides: SubscriptionOverrides = {}) {
    return {
        id: 'sub_team',
        status: 'active',
        customer: 'cus_org',
        cancel_at: null,
        cancel_at_period_end: false,
        metadata: { billing_scope: 'organization', organization_id: 'organization_1' },
        items: { data: [{ current_period_end: PERIOD_END, price: { id: 'price_teams' }, quantity: 4 }] },
        ...overrides,
    };
}

async function deliver(type: string, object: unknown) {
    mocks.constructEvent.mockReturnValue({ id: 'evt_1', type, data: { object } });
    return POST(new Request('http://localhost/api/billing/webhook', {
        method: 'POST',
        body: '{}',
        headers: { 'stripe-signature': 'test-signature' },
    }));
}

describe('POST /api/billing/webhook subscription sync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test');
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        mocks.getAccountById.mockResolvedValue({
            id: 'account_1',
            closure_status: 'active',
            subscription_status: 'pro',
            subscription_id: 'sub_current',
        });
        mocks.getOrganizationById.mockResolvedValue({ id: 'organization_1' });
        mocks.recordOperationalEvent.mockResolvedValue(true);
        mocks.recordOperationalSuccess.mockResolvedValue(true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
    });

    describe('a subscription that is not the one the account is on', () => {
        it.each([
            ['customer.subscription.deleted', 'canceled'],
            ['customer.subscription.updated', 'incomplete_expired'],
            ['customer.subscription.updated', 'past_due'],
        ])('acknowledges %s (%s) without downgrading the account', async (type, status) => {
            const response = await deliver(type, proSubscription({ id: 'sub_other', status }));

            expect(response.status).toBe(200);
            expect(mocks.updateAccountSubscription).not.toHaveBeenCalled();
            expect(mocks.recordOperationalEvent).not.toHaveBeenCalled();
            expect(mocks.recordOperationalSuccess).toHaveBeenCalledTimes(1);
        });

        it('still downgrades when the account’s own subscription ends', async () => {
            const response = await deliver(
                'customer.subscription.deleted',
                proSubscription({ status: 'canceled', cancel_at: CANCEL_AT })
            );

            expect(response.status).toBe(200);
            expect(mocks.updateAccountSubscription).toHaveBeenCalledWith('account_1', {
                subscriptionStatus: 'free',
                subscriptionId: null,
                subscriptionEndsAt: null,
                subscriptionCancelAt: null,
            });
        });

        it('applies an ended subscription to an account that has none stored', async () => {
            mocks.getAccountById.mockResolvedValue({
                id: 'account_1', closure_status: 'active', subscription_status: 'free', subscription_id: null,
            });

            const response = await deliver('customer.subscription.deleted', proSubscription({ status: 'canceled' }));

            expect(response.status).toBe(200);
            expect(mocks.updateAccountSubscription).toHaveBeenCalledTimes(1);
        });

        it('records a billing incident when a second paid subscription appears, and keeps the account on Pro', async () => {
            const response = await deliver('customer.subscription.updated', proSubscription({ id: 'sub_second' }));

            expect(response.status).toBe(200);
            expect(mocks.recordOperationalEvent).toHaveBeenCalledWith({
                category: 'billing_webhook',
                code: 'duplicate_subscription',
                outcome: 'failure',
                severity: 'critical',
                accountId: 'account_1',
            });
            expect(mocks.updateAccountSubscription).toHaveBeenCalledWith('account_1', {
                subscriptionStatus: 'pro',
                subscriptionId: 'sub_second',
                subscriptionEndsAt: new Date(PERIOD_END * 1000),
                subscriptionCancelAt: null,
            });
        });

        it('does not call a new subscription a duplicate when the stored one already lapsed', async () => {
            mocks.getAccountById.mockResolvedValue({
                id: 'account_1', closure_status: 'active', subscription_status: 'free', subscription_id: null,
            });

            await deliver('customer.subscription.updated', proSubscription({ id: 'sub_new' }));

            expect(mocks.recordOperationalEvent).not.toHaveBeenCalled();
            expect(mocks.updateAccountSubscription).toHaveBeenCalledWith(
                'account_1',
                expect.objectContaining({ subscriptionStatus: 'pro', subscriptionId: 'sub_new' })
            );
        });

        it('does not flag a renewal of the stored subscription', async () => {
            await deliver('customer.subscription.updated', proSubscription());

            expect(mocks.recordOperationalEvent).not.toHaveBeenCalled();
            expect(mocks.updateAccountSubscription).toHaveBeenCalledTimes(1);
        });
    });

    describe('when a plan is set to cancel', () => {
        it('stores Stripe’s cancellation date for Pro', async () => {
            await deliver(
                'customer.subscription.updated',
                proSubscription({ cancel_at: CANCEL_AT, cancel_at_period_end: true })
            );

            expect(mocks.updateAccountSubscription).toHaveBeenCalledWith('account_1', {
                subscriptionStatus: 'pro',
                subscriptionId: 'sub_current',
                subscriptionEndsAt: new Date(PERIOD_END * 1000),
                subscriptionCancelAt: new Date(CANCEL_AT * 1000),
            });
        });

        it('falls back to the period end when only the period-end flag is set', async () => {
            await deliver('customer.subscription.updated', proSubscription({ cancel_at_period_end: true }));

            expect(mocks.updateAccountSubscription).toHaveBeenCalledWith(
                'account_1',
                expect.objectContaining({ subscriptionCancelAt: new Date(PERIOD_END * 1000) })
            );
        });

        it('clears the date when the customer keeps the plan', async () => {
            await deliver('customer.subscription.updated', proSubscription());

            expect(mocks.updateAccountSubscription).toHaveBeenCalledWith(
                'account_1',
                expect.objectContaining({ subscriptionStatus: 'pro', subscriptionCancelAt: null })
            );
        });

        it('stores and clears the date for Teams', async () => {
            await deliver('customer.subscription.updated', teamSubscription({ cancel_at: CANCEL_AT }));
            expect(mocks.updateOrganizationSubscription).toHaveBeenLastCalledWith('organization_1', {
                subscriptionStatus: 'team',
                subscriptionId: 'sub_team',
                subscriptionEndsAt: new Date(PERIOD_END * 1000),
                subscriptionCancelAt: new Date(CANCEL_AT * 1000),
                seatQuantity: 4,
            });

            await deliver('customer.subscription.deleted', teamSubscription({ status: 'canceled', cancel_at: CANCEL_AT }));
            expect(mocks.updateOrganizationSubscription).toHaveBeenLastCalledWith('organization_1', {
                subscriptionStatus: 'free',
                subscriptionId: null,
                subscriptionEndsAt: null,
                subscriptionCancelAt: null,
                seatQuantity: 0,
            });
        });

        it('carries the date to the workspace when a Pro plan set to cancel becomes Teams', async () => {
            mocks.transferAccountSubscriptionToOrganization.mockResolvedValue({ account: {}, organization: {} });

            await deliver('customer.subscription.updated', teamSubscription({
                id: 'sub_current',
                cancel_at: CANCEL_AT,
                metadata: {
                    billing_scope: 'organization',
                    organization_id: 'organization_1',
                    converted_from_account_id: 'account_1',
                },
            }));

            expect(mocks.transferAccountSubscriptionToOrganization).toHaveBeenCalledWith({
                accountId: 'account_1',
                organizationId: 'organization_1',
                stripeCustomerId: 'cus_org',
                subscriptionId: 'sub_current',
                subscriptionEndsAt: new Date(PERIOD_END * 1000),
                subscriptionCancelAt: new Date(CANCEL_AT * 1000),
                seatQuantity: 4,
            });
        });
    });
});
