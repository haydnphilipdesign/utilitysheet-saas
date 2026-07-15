import 'server-only';

import { after } from 'next/server';
import { awardReferralCreditForActivation } from '@/lib/neon/queries';
import { applyEarnedReferralCredits } from '@/lib/referrals/referral-credit-service';

export function scheduleReferralCreditAward(referredAccountId: string): void {
    after(() => awardAndRedeemReferralCredit(referredAccountId));
}

export async function awardAndRedeemReferralCredit(
    referredAccountId: string
): Promise<void> {
    try {
        const awardedCredit = await awardReferralCreditForActivation(referredAccountId);
        if (!awardedCredit) return;

        await applyEarnedReferralCredits(awardedCredit.referrer_account_id);
    } catch (error) {
        console.error('Failed to award or redeem referral credit:', error);
    }
}
