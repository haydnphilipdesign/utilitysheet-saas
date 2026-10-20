import 'server-only';

import {
    getAccountById,
    getDefaultBrandProfile,
    getIntakeLinkBySlug,
} from '@/lib/neon/queries';
import { parseReferralCode } from './from-a-closing';

/**
 * The brand name behind a referral code, for /from-a-closing social proof.
 * Only active intake links on non-banned accounts resolve, and only the
 * brand name leaves this function: the same name the seller already sees on
 * that public intake link.
 */
export async function getSenderBrandName(referralCode: string | null): Promise<string | null> {
    const code = parseReferralCode(referralCode);
    if (!code) return null;

    try {
        const intakeLink = await getIntakeLinkBySlug(code);
        if (!intakeLink || !intakeLink.is_active) return null;

        const account = await getAccountById(intakeLink.account_id);
        if (!account || account.role === 'banned') return null;

        const brandProfile = await getDefaultBrandProfile(
            account.id,
            intakeLink.organization_id ?? undefined
        );
        return brandProfile?.name || null;
    } catch (error) {
        console.error('Failed to resolve sender brand for /from-a-closing:', error);
        return null;
    }
}
