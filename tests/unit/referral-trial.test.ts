import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const listSubscriptions = vi.fn();
    const configuredStripe = {
        subscriptions: { list: listSubscriptions },
    };

    return {
        configuredStripe,
        getValidReferralReferrerAccountId: vi.fn(),
        listSubscriptions,
        stripe: configuredStripe as typeof configuredStripe | null,
    };
});

vi.mock('server-only', () => ({}));

vi.mock('@/lib/neon/queries', () => ({
    getValidReferralReferrerAccountId: mocks.getValidReferralReferrerAccountId,
}));

vi.mock('@/lib/stripe/client', () => ({
    get stripe() {
        return mocks.stripe;
    },
}));

import { qualifiesForReferralTrial } from '@/lib/referrals/referral-trial';

describe('qualifiesForReferralTrial', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.stripe = mocks.configuredStripe;
        mocks.getValidReferralReferrerAccountId.mockResolvedValue('account_referrer');
        mocks.listSubscriptions.mockResolvedValue({ data: [] });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each(['missing', 'invalid']) (
        'returns false without querying Stripe for %s referral attribution',
        async () => {
            mocks.getValidReferralReferrerAccountId.mockResolvedValue(null);

            await expect(
                qualifiesForReferralTrial('account_referred', 'cus_referred')
            ).resolves.toBe(false);

            expect(mocks.getValidReferralReferrerAccountId).toHaveBeenCalledWith('account_referred');
            expect(mocks.listSubscriptions).not.toHaveBeenCalled();
        }
    );

    it('returns true for valid attribution with no subscription history', async () => {
        await expect(
            qualifiesForReferralTrial('account_referred', 'cus_referred')
        ).resolves.toBe(true);

        expect(mocks.listSubscriptions).toHaveBeenCalledTimes(1);
        expect(mocks.listSubscriptions).toHaveBeenCalledWith({
            customer: 'cus_referred',
            status: 'all',
            limit: 1,
        });
    });

    it('returns false when any subscription history exists, including canceled history', async () => {
        mocks.listSubscriptions.mockResolvedValue({
            data: [{ id: 'sub_canceled', status: 'canceled' }],
        });

        await expect(
            qualifiesForReferralTrial('account_referred', 'cus_referred')
        ).resolves.toBe(false);
    });

    it('returns false and logs when referral attribution cannot be queried', async () => {
        const error = new Error('Database unavailable');
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        mocks.getValidReferralReferrerAccountId.mockRejectedValue(error);

        await expect(
            qualifiesForReferralTrial('account_referred', 'cus_referred')
        ).resolves.toBe(false);

        expect(mocks.listSubscriptions).not.toHaveBeenCalled();
        expect(consoleError).toHaveBeenCalledWith(
            'Error qualifying account for referral trial:',
            error
        );
    });

    it('returns false and logs when Stripe is not configured', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        mocks.stripe = null;

        await expect(
            qualifiesForReferralTrial('account_referred', 'cus_referred')
        ).resolves.toBe(false);

        expect(mocks.listSubscriptions).not.toHaveBeenCalled();
        expect(consoleError).toHaveBeenCalledWith(
            'Error qualifying account for referral trial:',
            expect.any(Error)
        );
    });

    it('returns false and logs when Stripe subscription history fails', async () => {
        const error = new Error('Stripe unavailable');
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        mocks.listSubscriptions.mockRejectedValue(error);

        await expect(
            qualifiesForReferralTrial('account_referred', 'cus_referred')
        ).resolves.toBe(false);

        expect(consoleError).toHaveBeenCalledWith(
            'Error qualifying account for referral trial:',
            error
        );
    });
});
