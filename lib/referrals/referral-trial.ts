import 'server-only';

import { getValidReferralReferrerAccountId } from '@/lib/neon/queries';
import { stripe } from '@/lib/stripe/client';

export async function qualifiesForReferralTrial(
    accountId: string,
    stripeCustomerId: string
): Promise<boolean> {
    try {
        const referrerAccountId = await getValidReferralReferrerAccountId(accountId);
        if (!referrerAccountId) {
            return false;
        }

        if (!stripe) {
            throw new Error('Stripe is not configured; referral trial cannot be qualified');
        }

        const subscriptions = await stripe.subscriptions.list({
            customer: stripeCustomerId,
            status: 'all',
            limit: 1,
        });

        return subscriptions.data.length === 0;
    } catch (error) {
        console.error('Error qualifying account for referral trial:', error);
        return false;
    }
}
