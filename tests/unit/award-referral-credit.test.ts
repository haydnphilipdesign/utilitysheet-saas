import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    applyEarnedReferralCredits: vi.fn(),
    awardReferralCreditForActivation: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/neon/queries', () => ({
    awardReferralCreditForActivation: mocks.awardReferralCreditForActivation,
}));

vi.mock('@/lib/referrals/referral-credit-service', () => ({
    applyEarnedReferralCredits: mocks.applyEarnedReferralCredits,
}));

import { awardAndRedeemReferralCredit } from '@/lib/referrals/award-referral-credit';

describe('awardAndRedeemReferralCredit', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('does not redeem when no referral credit is awarded', async () => {
        mocks.awardReferralCreditForActivation.mockResolvedValue(null);

        await expect(awardAndRedeemReferralCredit('account_referred')).resolves.toBeUndefined();

        expect(mocks.awardReferralCreditForActivation).toHaveBeenCalledWith('account_referred');
        expect(mocks.applyEarnedReferralCredits).not.toHaveBeenCalled();
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('redeems credits for the referrer returned by the award query', async () => {
        mocks.awardReferralCreditForActivation.mockResolvedValue({
            referrer_account_id: 'account_referrer',
        });
        mocks.applyEarnedReferralCredits.mockResolvedValue(['credit_1']);

        await expect(awardAndRedeemReferralCredit('account_referred')).resolves.toBeUndefined();

        expect(mocks.applyEarnedReferralCredits).toHaveBeenCalledWith('account_referrer');
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('swallows and logs award failures', async () => {
        const error = new Error('Award query unavailable');
        mocks.awardReferralCreditForActivation.mockRejectedValue(error);

        await expect(awardAndRedeemReferralCredit('account_referred')).resolves.toBeUndefined();

        expect(mocks.applyEarnedReferralCredits).not.toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Failed to award or redeem referral credit:',
            error
        );
    });

    it('swallows and logs redemption failures', async () => {
        const error = new Error('Stripe unavailable');
        mocks.awardReferralCreditForActivation.mockResolvedValue({
            referrer_account_id: 'account_referrer',
        });
        mocks.applyEarnedReferralCredits.mockRejectedValue(error);

        await expect(awardAndRedeemReferralCredit('account_referred')).resolves.toBeUndefined();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Failed to award or redeem referral credit:',
            error
        );
    });
});
