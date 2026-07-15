import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const createBalanceTransaction = vi.fn();
    const retrieveSubscription = vi.fn();
    const configuredStripe = {
        customers: { createBalanceTransaction },
        subscriptions: { retrieve: retrieveSubscription },
    };

    return {
        configuredStripe,
        createBalanceTransaction,
        getAccountById: vi.fn(),
        getEarnedReferralCredits: vi.fn(),
        markReferralCreditApplied: vi.fn(),
        retrieveSubscription,
        stripe: configuredStripe as typeof configuredStripe | null,
    };
});

vi.mock('server-only', () => ({}));

vi.mock('@/lib/stripe/client', () => ({
    get stripe() {
        return mocks.stripe;
    },
}));

vi.mock('@/lib/neon/queries', () => ({
    getAccountById: mocks.getAccountById,
    getEarnedReferralCredits: mocks.getEarnedReferralCredits,
    markReferralCreditApplied: mocks.markReferralCreditApplied,
}));

import { applyEarnedReferralCredits } from '@/lib/referrals/referral-credit-service';

const earnedCredit = {
    id: 'credit_1',
    referrer_account_id: 'account_referrer',
    referred_account_id: 'account_referred',
    amount_cents: 900,
    status: 'earned' as const,
    stripe_balance_transaction_id: null,
    earned_at: '2026-07-15T12:00:00.000Z',
    applied_at: null,
};

const account = {
    id: 'account_referrer',
    stripe_customer_id: 'cus_referrer',
    subscription_id: 'sub_referrer',
};

describe('applyEarnedReferralCredits', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.stripe = mocks.configuredStripe;
        mocks.getAccountById.mockResolvedValue(account);
        mocks.retrieveSubscription.mockResolvedValue({ status: 'active' });
        mocks.getEarnedReferralCredits.mockResolvedValue([earnedCredit]);
        mocks.createBalanceTransaction.mockResolvedValue({ id: 'cbtxn_1' });
        mocks.markReferralCreditApplied.mockResolvedValue({
            ...earnedCredit,
            status: 'applied',
            stripe_balance_transaction_id: 'cbtxn_1',
        });
    });

    it('applies an earned credit to an active subscriber with a stable idempotency key', async () => {
        await expect(applyEarnedReferralCredits('account_referrer')).resolves.toEqual(['credit_1']);

        expect(mocks.getAccountById).toHaveBeenCalledWith('account_referrer');
        expect(mocks.retrieveSubscription).toHaveBeenCalledWith('sub_referrer');
        expect(mocks.getEarnedReferralCredits).toHaveBeenCalledWith('account_referrer');
        expect(mocks.createBalanceTransaction).toHaveBeenCalledWith(
            'cus_referrer',
            {
                amount: -900,
                currency: 'usd',
                description: 'Referral Pro credit',
                metadata: {
                    referral_credit_id: 'credit_1',
                    account_id: 'account_referrer',
                },
            },
            { idempotencyKey: 'referral-credit-credit_1' }
        );
        expect(mocks.markReferralCreditApplied).toHaveBeenCalledWith('credit_1', 'cbtxn_1');
    });

    it('returns early when the account has no Stripe customer', async () => {
        mocks.getAccountById.mockResolvedValue({
            ...account,
            stripe_customer_id: null,
        });

        await expect(applyEarnedReferralCredits('account_referrer')).resolves.toEqual([]);

        expect(mocks.retrieveSubscription).not.toHaveBeenCalled();
        expect(mocks.getEarnedReferralCredits).not.toHaveBeenCalled();
        expect(mocks.createBalanceTransaction).not.toHaveBeenCalled();
    });

    it('returns early in guarded mode when the account has no subscription', async () => {
        mocks.getAccountById.mockResolvedValue({
            ...account,
            subscription_id: null,
        });

        await expect(applyEarnedReferralCredits('account_referrer')).resolves.toEqual([]);

        expect(mocks.retrieveSubscription).not.toHaveBeenCalled();
        expect(mocks.getEarnedReferralCredits).not.toHaveBeenCalled();
        expect(mocks.createBalanceTransaction).not.toHaveBeenCalled();
    });

    it('accepts a trialing subscription', async () => {
        mocks.retrieveSubscription.mockResolvedValue({ status: 'trialing' });

        await expect(applyEarnedReferralCredits('account_referrer')).resolves.toEqual(['credit_1']);

        expect(mocks.createBalanceTransaction).toHaveBeenCalledTimes(1);
    });

    it.each(['past_due', 'canceled', 'incomplete', 'unpaid']) (
        'returns early for an inactive %s subscription',
        async (status) => {
            mocks.retrieveSubscription.mockResolvedValue({ status });

            await expect(applyEarnedReferralCredits('account_referrer')).resolves.toEqual([]);

            expect(mocks.getEarnedReferralCredits).not.toHaveBeenCalled();
            expect(mocks.createBalanceTransaction).not.toHaveBeenCalled();
            expect(mocks.markReferralCreditApplied).not.toHaveBeenCalled();
        }
    );

    it('skips subscription retrieval in checkout mode and applies every earned credit sequentially', async () => {
        const secondCredit = {
            ...earnedCredit,
            id: 'credit_2',
            referred_account_id: 'account_referred_2',
            amount_cents: 500,
        };
        mocks.getAccountById.mockResolvedValue({
            ...account,
            subscription_id: null,
        });
        mocks.getEarnedReferralCredits.mockResolvedValue([earnedCredit, secondCredit]);
        mocks.createBalanceTransaction
            .mockResolvedValueOnce({ id: 'cbtxn_1' })
            .mockResolvedValueOnce({ id: 'cbtxn_2' });
        mocks.markReferralCreditApplied
            .mockResolvedValueOnce({ ...earnedCredit, status: 'applied' })
            .mockResolvedValueOnce({ ...secondCredit, status: 'applied' });

        await expect(
            applyEarnedReferralCredits('account_referrer', { requireActiveSubscription: false })
        ).resolves.toEqual(['credit_1', 'credit_2']);

        expect(mocks.retrieveSubscription).not.toHaveBeenCalled();
        expect(mocks.createBalanceTransaction).toHaveBeenCalledTimes(2);
        expect(mocks.createBalanceTransaction).toHaveBeenNthCalledWith(
            2,
            'cus_referrer',
            expect.objectContaining({
                amount: -500,
                metadata: {
                    referral_credit_id: 'credit_2',
                    account_id: 'account_referrer',
                },
            }),
            { idempotencyKey: 'referral-credit-credit_2' }
        );
        expect(mocks.createBalanceTransaction.mock.invocationCallOrder[1]).toBeGreaterThan(
            mocks.markReferralCreditApplied.mock.invocationCallOrder[0]
        );
    });

    it('omits a credit when the conditional applied update returns null', async () => {
        mocks.markReferralCreditApplied.mockResolvedValue(null);

        await expect(applyEarnedReferralCredits('account_referrer')).resolves.toEqual([]);

        expect(mocks.createBalanceTransaction).toHaveBeenCalledTimes(1);
        expect(mocks.markReferralCreditApplied).toHaveBeenCalledWith('credit_1', 'cbtxn_1');
    });

    it('throws explicitly when Stripe is not configured for an applicable account', async () => {
        mocks.stripe = null;

        await expect(
            applyEarnedReferralCredits('account_referrer', { requireActiveSubscription: false })
        ).rejects.toThrow('Stripe is not configured; referral credits cannot be applied');

        expect(mocks.getEarnedReferralCredits).not.toHaveBeenCalled();
        expect(mocks.markReferralCreditApplied).not.toHaveBeenCalled();
    });

    it('propagates Stripe failures without marking the credit applied', async () => {
        const stripeError = new Error('Stripe unavailable');
        mocks.createBalanceTransaction.mockRejectedValue(stripeError);

        await expect(applyEarnedReferralCredits('account_referrer')).rejects.toBe(stripeError);

        expect(mocks.markReferralCreditApplied).not.toHaveBeenCalled();
    });

    it('propagates database failures after Stripe succeeds', async () => {
        const databaseError = new Error('Database unavailable');
        mocks.markReferralCreditApplied.mockRejectedValue(databaseError);

        await expect(applyEarnedReferralCredits('account_referrer')).rejects.toBe(databaseError);

        expect(mocks.createBalanceTransaction).toHaveBeenCalledTimes(1);
    });
});
