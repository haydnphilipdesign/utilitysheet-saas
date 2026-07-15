import { sql } from '@/lib/neon/db';

export type ReferralCreditStatus = 'earned' | 'applied';

export interface ReferralCredit {
    id: string;
    referrer_account_id: string;
    referred_account_id: string;
    amount_cents: number;
    status: ReferralCreditStatus;
    stripe_balance_transaction_id: string | null;
    earned_at: string;
    applied_at: string | null;
}

export interface AwardedReferralCredit extends ReferralCredit {
    referrer_stripe_customer_id: string | null;
    referrer_subscription_id: string | null;
    referrer_subscription_status: string;
}

export async function awardReferralCreditForActivation(
    referredAccountId: string
): Promise<AwardedReferralCredit | null> {
    if (!sql) return null;

    const [, insertedCredits] = await sql.transaction([
        sql`
            SELECT referrer.id
            FROM growth_attributions ga
            JOIN intake_links il ON ga.referral_code = il.slug
            JOIN accounts referrer ON referrer.id = il.account_id
            WHERE ga.account_id = ${referredAccountId}
              AND il.account_id <> ga.account_id
              AND (
                  SELECT COUNT(*)
                  FROM requests
                  WHERE account_id = ga.account_id
                    AND status = 'submitted'
                    AND deleted_at IS NULL
                    AND COALESCE(is_demo, FALSE) = FALSE
              ) = 1
              AND (
                  SELECT COUNT(*)
                  FROM referral_credits existing_credit
                  WHERE existing_credit.referrer_account_id = il.account_id
                    AND existing_credit.earned_at >= NOW() - INTERVAL '365 days'
              ) < 12
            FOR UPDATE OF referrer
        `,
        sql`
            WITH eligible_candidate AS (
                SELECT
                    ga.account_id AS referred_account_id,
                    il.account_id AS referrer_account_id
                FROM growth_attributions ga
                JOIN intake_links il ON ga.referral_code = il.slug
                WHERE ga.account_id = ${referredAccountId}
                  AND il.account_id <> ga.account_id
                  AND (
                      SELECT COUNT(*)
                      FROM requests
                      WHERE account_id = ga.account_id
                        AND status = 'submitted'
                        AND deleted_at IS NULL
                        AND COALESCE(is_demo, FALSE) = FALSE
                  ) = 1
                  AND (
                      SELECT COUNT(*)
                      FROM referral_credits existing_credit
                      WHERE existing_credit.referrer_account_id = il.account_id
                        AND existing_credit.earned_at >= NOW() - INTERVAL '365 days'
                  ) < 12
            ),
            inserted_credit AS (
                INSERT INTO referral_credits (
                    referrer_account_id,
                    referred_account_id
                )
                SELECT
                    referrer_account_id,
                    referred_account_id
                FROM eligible_candidate
                ON CONFLICT (referred_account_id) DO NOTHING
                RETURNING *
            )
            SELECT
                inserted_credit.*,
                referrer.stripe_customer_id AS referrer_stripe_customer_id,
                referrer.subscription_id AS referrer_subscription_id,
                referrer.subscription_status AS referrer_subscription_status
            FROM inserted_credit
            JOIN accounts referrer ON referrer.id = inserted_credit.referrer_account_id
        `,
    ]);

    return (insertedCredits[0] as AwardedReferralCredit) || null;
}

export async function getReferralCreditsForAccount(accountId: string): Promise<ReferralCredit[]> {
    if (!sql) return [];

    const result = await sql`
        SELECT *
        FROM referral_credits
        WHERE referrer_account_id = ${accountId}
        ORDER BY earned_at DESC, id DESC
    `;

    return result as ReferralCredit[];
}

export async function getEarnedReferralCredits(accountId: string): Promise<ReferralCredit[]> {
    if (!sql) return [];

    const result = await sql`
        SELECT *
        FROM referral_credits
        WHERE referrer_account_id = ${accountId}
          AND status = 'earned'
        ORDER BY earned_at DESC, id DESC
    `;

    return result as ReferralCredit[];
}

export async function markReferralCreditApplied(
    creditId: string,
    stripeBalanceTransactionId: string
): Promise<ReferralCredit | null> {
    if (!sql) return null;

    const result = await sql`
        UPDATE referral_credits
        SET
            status = 'applied',
            stripe_balance_transaction_id = ${stripeBalanceTransactionId},
            applied_at = NOW()
        WHERE id = ${creditId}
          AND status = 'earned'
        RETURNING *
    `;

    return (result[0] as ReferralCredit) || null;
}

export async function getValidReferralReferrerAccountId(
    referredAccountId: string
): Promise<string | null> {
    if (!sql) return null;

    const result = await sql`
        SELECT il.account_id AS referrer_account_id
        FROM growth_attributions ga
        JOIN intake_links il ON ga.referral_code = il.slug
        WHERE ga.account_id = ${referredAccountId}
          AND il.account_id <> ga.account_id
        LIMIT 1
    `;

    return (result[0]?.referrer_account_id as string | undefined) || null;
}
