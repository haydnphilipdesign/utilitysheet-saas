import 'server-only';

import {
    getAccountById,
    getEarnedReferralCredits,
    markReferralCreditApplied,
} from '@/lib/neon/queries';
import { stripe } from '@/lib/stripe/client';

const APPLICABLE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

export async function applyEarnedReferralCredits(
    accountId: string,
    options: { requireActiveSubscription?: boolean } = {}
): Promise<string[]> {
    const account = await getAccountById(accountId);
    if (!account?.stripe_customer_id) {
        return [];
    }

    const requireActiveSubscription = options.requireActiveSubscription ?? true;
    if (requireActiveSubscription && !account.subscription_id) {
        return [];
    }

    if (!stripe) {
        throw new Error('Stripe is not configured; referral credits cannot be applied');
    }

    if (requireActiveSubscription) {
        const subscription = await stripe.subscriptions.retrieve(account.subscription_id);
        if (!APPLICABLE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
            return [];
        }
    }

    const earnedCredits = await getEarnedReferralCredits(accountId);
    const appliedCreditIds: string[] = [];

    for (const credit of earnedCredits) {
        const balanceTransaction = await stripe.customers.createBalanceTransaction(
            account.stripe_customer_id,
            {
                amount: -credit.amount_cents,
                currency: 'usd',
                description: 'Referral Pro credit',
                metadata: {
                    referral_credit_id: credit.id,
                    account_id: accountId,
                },
            },
            { idempotencyKey: `referral-credit-${credit.id}` }
        );

        const appliedCredit = await markReferralCreditApplied(credit.id, balanceTransaction.id);
        if (appliedCredit) {
            appliedCreditIds.push(credit.id);
        }
    }

    return appliedCreditIds;
}
