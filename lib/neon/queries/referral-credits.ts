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
    referrer_email: string | null;
    referrer_full_name: string | null;
}

export type ReferralCreditCounts = {
    earned: number;
    applied: number;
};

export type ReferralClaimStatus = 'available' | 'claimed' | 'expired' | 'unavailable';

export type ReferralClaimState = {
    code: string | null;
    canClaim: boolean;
    status: ReferralClaimStatus;
};

export type ClaimReferralCodeResult = {
    code: string | null;
    status:
        | 'claimed'
        | 'invalid_code'
        | 'already_claimed'
        | 'expired'
        | 'account_not_found'
        | 'unavailable';
};

export async function getReferralClaimState(accountId: string): Promise<ReferralClaimState> {
    if (!sql) return { code: null, canClaim: false, status: 'unavailable' };

    const result = await sql`
        SELECT
            ga.referral_code,
            a.created_at >= NOW() - INTERVAL '30 days' AS within_claim_window
        FROM accounts a
        LEFT JOIN growth_attributions ga ON ga.account_id = a.id
        WHERE a.id = ${accountId}
        LIMIT 1
    `;
    const row = result[0];
    if (!row) return { code: null, canClaim: false, status: 'unavailable' };

    const code = (row.referral_code as string | null | undefined) || null;
    if (code) return { code, canClaim: false, status: 'claimed' };
    if (!Boolean(row.within_claim_window)) {
        return { code: null, canClaim: false, status: 'expired' };
    }

    return { code: null, canClaim: true, status: 'available' };
}

export async function claimReferralCodeForAccount(
    accountId: string,
    referralCode: string
): Promise<ClaimReferralCodeResult> {
    if (!sql) return { code: null, status: 'unavailable' };

    const result = await sql`
        WITH account_state AS (
            SELECT
                a.id,
                ga.referral_code AS existing_referral_code,
                a.created_at >= NOW() - INTERVAL '30 days' AS within_claim_window
            FROM accounts a
            LEFT JOIN growth_attributions ga ON ga.account_id = a.id
            WHERE a.id = ${accountId}
            FOR UPDATE OF a
        ),
        valid_referral AS (
            SELECT il.slug
            FROM intake_links il
            JOIN account_state state ON il.account_id <> state.id
            WHERE il.slug = ${referralCode}
            LIMIT 1
        ),
        claimed AS (
            INSERT INTO growth_attributions (
                account_id,
                source,
                medium,
                campaign,
                content,
                referral_code,
                landing_path
            )
            SELECT
                state.id,
                'post_signup_referral',
                'product_referral',
                'manual_referral_code',
                'settings',
                valid_referral.slug,
                '/dashboard/settings'
            FROM account_state state
            CROSS JOIN valid_referral
            WHERE state.existing_referral_code IS NULL
              AND state.within_claim_window = TRUE
            ON CONFLICT (account_id) DO UPDATE
                SET referral_code = EXCLUDED.referral_code
                WHERE growth_attributions.referral_code IS NULL
            RETURNING referral_code
        )
        SELECT
            CASE
                WHEN NOT EXISTS (SELECT 1 FROM account_state) THEN 'account_not_found'
                WHEN (SELECT existing_referral_code FROM account_state) IS NOT NULL THEN 'already_claimed'
                WHEN NOT (SELECT within_claim_window FROM account_state) THEN 'expired'
                WHEN NOT EXISTS (SELECT 1 FROM valid_referral) THEN 'invalid_code'
                WHEN EXISTS (SELECT 1 FROM claimed) THEN 'claimed'
                ELSE 'already_claimed'
            END AS status,
            COALESCE(
                (SELECT referral_code FROM claimed),
                (SELECT existing_referral_code FROM account_state)
            ) AS referral_code
    `;
    const row = result[0];
    if (!row) return { code: null, status: 'unavailable' };

    return {
        code: (row.referral_code as string | null | undefined) || null,
        status: row.status as ClaimReferralCodeResult['status'],
    };
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
              ) >= 1
              AND (
                  SELECT COUNT(*)
                  FROM referral_credits existing_credit
                  WHERE existing_credit.referrer_account_id = il.account_id
                    AND existing_credit.earned_at >= NOW() - INTERVAL '365 days'
              ) < 12
            FOR UPDATE OF referrer, il
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
                  ) >= 1
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
                referrer.subscription_status AS referrer_subscription_status,
                referrer.email AS referrer_email,
                referrer.full_name AS referrer_full_name
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

export async function getReferralCreditCountsForAccount(accountId: string): Promise<ReferralCreditCounts> {
    if (!sql) return { earned: 0, applied: 0 };

    const result = await sql`
        SELECT
            COUNT(*) FILTER (WHERE status = 'earned')::int AS earned,
            COUNT(*) FILTER (WHERE status = 'applied')::int AS applied
        FROM referral_credits
        WHERE referrer_account_id = ${accountId}
    `;
    const row = result[0];

    return {
        earned: Number(row?.earned) || 0,
        applied: Number(row?.applied) || 0,
    };
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
