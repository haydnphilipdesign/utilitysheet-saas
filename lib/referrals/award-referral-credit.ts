import 'server-only';

import { awardReferralCreditForActivation } from '@/lib/neon/queries';
import { applyEarnedReferralCredits } from '@/lib/referrals/referral-credit-service';

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
