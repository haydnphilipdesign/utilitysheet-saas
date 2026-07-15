import 'server-only';

import { after } from 'next/server';
import { awardReferralCreditForActivation } from '@/lib/neon/queries';
import { applyEarnedReferralCredits } from '@/lib/referrals/referral-credit-service';
import { sendReferralCreditEarnedEmail } from '@/lib/email/email-service';
import type { ReferralCreditEarnedStatus } from '@/lib/email/email-service';
import type { AwardedReferralCredit } from '@/lib/neon/queries/referral-credits';

export function scheduleReferralCreditAward(referredAccountId: string): void {
    after(() => awardAndRedeemReferralCredit(referredAccountId));
}

export async function awardAndRedeemReferralCredit(
    referredAccountId: string
): Promise<void> {
    let awardedCredit: AwardedReferralCredit | null = null;
    let appliedCreditIds: string[] = [];

    try {
        awardedCredit = await awardReferralCreditForActivation(referredAccountId);
        if (!awardedCredit) return;

        appliedCreditIds = await applyEarnedReferralCredits(awardedCredit.referrer_account_id);
    } catch (error) {
        console.error('Failed to award or redeem referral credit:', error);
    }

    if (!awardedCredit?.referrer_email) return;

    const creditStatus: ReferralCreditEarnedStatus = appliedCreditIds.includes(awardedCredit.id)
        ? 'applied'
        : awardedCredit.referrer_subscription_id
            ? 'saved'
            : 'waiting_for_upgrade';

    try {
        await sendReferralCreditEarnedEmail({
            toEmail: awardedCredit.referrer_email,
            toName: awardedCredit.referrer_full_name || undefined,
            creditStatus,
        });
    } catch (error) {
        console.error('Failed to send referral credit earned email:', error);
    }
}
