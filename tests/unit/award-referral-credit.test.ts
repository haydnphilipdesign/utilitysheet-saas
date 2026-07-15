import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const mocks = vi.hoisted(() => ({
    after: vi.fn(),
    applyEarnedReferralCredits: vi.fn(),
    awardReferralCreditForActivation: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next/server', () => ({
    after: mocks.after,
}));

vi.mock('@/lib/neon/queries', () => ({
    awardReferralCreditForActivation: mocks.awardReferralCreditForActivation,
}));

vi.mock('@/lib/referrals/referral-credit-service', () => ({
    applyEarnedReferralCredits: mocks.applyEarnedReferralCredits,
}));

import { scheduleReferralCreditAward } from '@/lib/referrals/award-referral-credit';

function scheduleAndCaptureCallback(): () => Promise<void> {
    scheduleReferralCreditAward('account_referred');

    expect(mocks.awardReferralCreditForActivation).not.toHaveBeenCalled();
    expect(mocks.applyEarnedReferralCredits).not.toHaveBeenCalled();
    expect(mocks.after).toHaveBeenCalledTimes(1);

    return mocks.after.mock.calls[0][0] as () => Promise<void>;
}

describe('scheduleReferralCreditAward', () => {
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

        const callback = scheduleAndCaptureCallback();
        await expect(callback()).resolves.toBeUndefined();

        expect(mocks.awardReferralCreditForActivation).toHaveBeenCalledWith('account_referred');
        expect(mocks.applyEarnedReferralCredits).not.toHaveBeenCalled();
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('redeems credits for the referrer returned by the award query', async () => {
        mocks.awardReferralCreditForActivation.mockResolvedValue({
            referrer_account_id: 'account_referrer',
        });
        mocks.applyEarnedReferralCredits.mockResolvedValue(['credit_1']);

        const callback = scheduleAndCaptureCallback();
        await expect(callback()).resolves.toBeUndefined();

        expect(mocks.applyEarnedReferralCredits).toHaveBeenCalledWith('account_referrer');
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('swallows and logs award failures', async () => {
        const error = new Error('Award query unavailable');
        mocks.awardReferralCreditForActivation.mockRejectedValue(error);

        const callback = scheduleAndCaptureCallback();
        await expect(callback()).resolves.toBeUndefined();

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

        const callback = scheduleAndCaptureCallback();
        await expect(callback()).resolves.toBeUndefined();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Failed to award or redeem referral credit:',
            error
        );
    });

    it('is scheduled only after utility entries and the seller submission event are persisted', () => {
        const routeSource = readFileSync(
            join(process.cwd(), 'app/api/seller/[token]/route.ts'),
            'utf8'
        );
        const utilityInsertIndex = routeSource.indexOf('INSERT INTO utility_entries');
        const sellerSubmittedEventIndex = routeSource.indexOf("eventType: 'seller_submitted'");
        const scheduleIndex = routeSource.indexOf(
            'scheduleReferralCreditAward(requestData.account_id);'
        );

        expect(utilityInsertIndex).toBeGreaterThan(-1);
        expect(sellerSubmittedEventIndex).toBeGreaterThan(utilityInsertIndex);
        expect(scheduleIndex).toBeGreaterThan(sellerSubmittedEventIndex);
        expect(routeSource).not.toContain(
            'await scheduleReferralCreditAward(requestData.account_id);'
        );
    });
});
