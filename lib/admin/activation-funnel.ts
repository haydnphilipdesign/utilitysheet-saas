import 'server-only';

import { sql } from '@/lib/neon/db';

type ActivationFunnelAggregateRow = {
    total_accounts?: number | string | null;
    onboarding_completed?: number | string | null;
    dashboard_ready?: number | string | null;
    has_request?: number | string | null;
    seller_link_ready?: number | string | null;
    no_onboarding_no_request?: number | string | null;
    missing_defaults?: number | string | null;
    first_live_submission?: number | string | null;
    habitual_accounts?: number | string | null;
    paid_accounts?: number | string | null;
    first_live_submission_last_7d?: number | string | null;
};

type GrowthSourceAggregateRow = {
    source?: string | null;
    signups?: number | string | null;
    activated?: number | string | null;
};

type ReferralLoopAggregateRow = {
    impressions?: number | string | null;
    clicks?: number | string | null;
    signups?: number | string | null;
    activated?: number | string | null;
};

export type ActivationFunnelStats = {
    totalAccounts: number;
    dashboardReady: number;
    onboardingCompleted: number;
    hasRequest: number;
    sellerLinkReady: number;
    noOnboardingNoRequest: number;
    missingDefaults: number;
    firstLiveSubmission: number;
    habitualAccounts: number;
    paidAccounts: number;
    firstLiveSubmissionLast7d: number;
    dashboardReadyRate: number;
    onboardingCompletionRate: number;
    firstRequestRate: number;
    inactiveRate: number;
    signupToActivationRate: number;
    activationToHabitRate: number;
};

export type GrowthSourceStats = {
    source: string;
    signups: number;
    activated: number;
    activationRate: number;
};

export type ReferralLoopStats = {
    impressions: number;
    clicks: number;
    signups: number;
    activated: number;
    clickRate: number;
    signupRate: number;
    activationRate: number;
};

export function hasReferralLoopObservations(stats: ReferralLoopStats | null | undefined): boolean {
    if (!stats) return false;
    return stats.impressions + stats.clicks + stats.signups + stats.activated > 0;
}

function asCount(value: number | string | null | undefined) {
    return Number(value || 0);
}

function percent(part: number, total: number) {
    if (total <= 0) return 0;
    return Math.round((part / total) * 100);
}

export function toActivationFunnelStats(row: ActivationFunnelAggregateRow): ActivationFunnelStats {
    const totalAccounts = asCount(row.total_accounts);
    const dashboardReady = asCount(row.dashboard_ready);
    const onboardingCompleted = asCount(row.onboarding_completed);
    const hasRequest = asCount(row.has_request);
    const sellerLinkReady = asCount(row.seller_link_ready);
    const noOnboardingNoRequest = asCount(row.no_onboarding_no_request);
    const missingDefaults = asCount(row.missing_defaults);
    const firstLiveSubmission = asCount(row.first_live_submission);
    const habitualAccounts = asCount(row.habitual_accounts);
    const paidAccounts = asCount(row.paid_accounts);
    const firstLiveSubmissionLast7d = asCount(row.first_live_submission_last_7d);

    return {
        totalAccounts,
        dashboardReady,
        onboardingCompleted,
        hasRequest,
        sellerLinkReady,
        noOnboardingNoRequest,
        missingDefaults,
        firstLiveSubmission,
        habitualAccounts,
        paidAccounts,
        firstLiveSubmissionLast7d,
        dashboardReadyRate: percent(dashboardReady, totalAccounts),
        onboardingCompletionRate: percent(onboardingCompleted, totalAccounts),
        firstRequestRate: percent(hasRequest, totalAccounts),
        inactiveRate: percent(noOnboardingNoRequest, totalAccounts),
        signupToActivationRate: percent(firstLiveSubmission, totalAccounts),
        activationToHabitRate: percent(habitualAccounts, firstLiveSubmission),
    };
}

export function toGrowthSourceStats(rows: GrowthSourceAggregateRow[]): GrowthSourceStats[] {
    return rows.map((row) => {
        const signups = asCount(row.signups);
        const activated = asCount(row.activated);

        return {
            source: row.source || 'unknown',
            signups,
            activated,
            activationRate: percent(activated, signups),
        };
    });
}

export function toReferralLoopStats(row: ReferralLoopAggregateRow): ReferralLoopStats {
    const impressions = asCount(row.impressions);
    const clicks = asCount(row.clicks);
    const signups = asCount(row.signups);
    const activated = asCount(row.activated);

    return {
        impressions,
        clicks,
        signups,
        activated,
        clickRate: percent(clicks, impressions),
        signupRate: percent(signups, clicks),
        activationRate: percent(activated, signups),
    };
}

export async function getActivationFunnelStats(): Promise<ActivationFunnelStats | null> {
    if (!sql) return null;

    const result = await sql`
        WITH request_counts AS (
            SELECT account_id, COUNT(*)::int AS request_count
            FROM requests
            WHERE deleted_at IS NULL
              AND COALESCE(is_demo, FALSE) = FALSE
            GROUP BY account_id
        ),
        default_counts AS (
            SELECT
                a.id AS account_id,
                CASE WHEN a.active_organization_id IS NOT NULL THEN 1 ELSE 0 END AS has_active_org,
                CASE WHEN COUNT(DISTINCT bp.id) > 0 THEN 1 ELSE 0 END AS has_brand_profile,
                CASE WHEN COUNT(DISTINCT il.id) > 0 THEN 1 ELSE 0 END AS has_intake_link
            FROM accounts a
            LEFT JOIN brand_profiles bp ON bp.account_id = a.id
            LEFT JOIN intake_links il ON il.account_id = a.id
            GROUP BY a.id
        ),
        live_submission_counts AS (
            SELECT
                account_id,
                COUNT(*) FILTER (
                    WHERE status = 'submitted'
                      AND deleted_at IS NULL
                      AND COALESCE(is_demo, FALSE) = FALSE
                      AND COALESCE(metered_at, last_activity_at) >= NOW() - INTERVAL '30 days'
                )::int AS submitted_count_30d,
                MIN(COALESCE(metered_at, last_activity_at)) FILTER (
                    WHERE status = 'submitted'
                      AND deleted_at IS NULL
                      AND COALESCE(is_demo, FALSE) = FALSE
                ) AS first_submitted_at
            FROM requests
            GROUP BY account_id
        )
        SELECT
            COUNT(*)::int AS total_accounts,
            COUNT(*) FILTER (WHERE dc.has_active_org = 1 AND dc.has_brand_profile = 1)::int AS dashboard_ready,
            COUNT(*) FILTER (WHERE a.onboarding_completed_at IS NOT NULL)::int AS onboarding_completed,
            COUNT(*) FILTER (WHERE COALESCE(rc.request_count, 0) > 0)::int AS has_request,
            COUNT(*) FILTER (WHERE dc.has_intake_link = 1)::int AS seller_link_ready,
            COUNT(*) FILTER (
                WHERE a.onboarding_completed_at IS NULL
                  AND COALESCE(rc.request_count, 0) = 0
            )::int AS no_onboarding_no_request,
            COUNT(*) FILTER (
                WHERE dc.has_active_org = 0
                   OR dc.has_brand_profile = 0
                   OR dc.has_intake_link = 0
            )::int AS missing_defaults,
            COUNT(*) FILTER (WHERE lsc.first_submitted_at IS NOT NULL)::int AS first_live_submission,
            COUNT(*) FILTER (WHERE lsc.submitted_count_30d >= 3)::int AS habitual_accounts,
            COUNT(*) FILTER (
                WHERE a.subscription_status = 'pro' OR EXISTS (
                    SELECT 1
                    FROM organizations paid_org
                    WHERE paid_org.id = a.active_organization_id
                      AND paid_org.subscription_status = 'team'
                )
            )::int AS paid_accounts,
            COUNT(*) FILTER (
                WHERE lsc.first_submitted_at >= NOW() - INTERVAL '7 days'
            )::int AS first_live_submission_last_7d
        FROM accounts a
        LEFT JOIN request_counts rc ON rc.account_id = a.id
        LEFT JOIN default_counts dc ON dc.account_id = a.id
        LEFT JOIN live_submission_counts lsc ON lsc.account_id = a.id
        WHERE a.role = 'user'
    `;

    return toActivationFunnelStats(result[0] || {});
}

export async function getGrowthSourceStats(): Promise<GrowthSourceStats[]> {
    if (!sql) return [];

    const result = await sql`
        WITH activated_accounts AS (
            SELECT DISTINCT account_id
            FROM requests
            WHERE status = 'submitted'
              AND deleted_at IS NULL
              AND COALESCE(is_demo, FALSE) = FALSE
        )
        SELECT
            COALESCE(ga.source, 'unknown') AS source,
            COUNT(*)::int AS signups,
            COUNT(*) FILTER (WHERE aa.account_id IS NOT NULL)::int AS activated
        FROM accounts a
        LEFT JOIN growth_attributions ga ON ga.account_id = a.id
        LEFT JOIN activated_accounts aa ON aa.account_id = a.id
        WHERE a.role = 'user'
          AND a.created_at >= NOW() - INTERVAL '90 days'
        GROUP BY COALESCE(ga.source, 'unknown')
        ORDER BY activated DESC, signups DESC, source ASC
    `;

    return toGrowthSourceStats(result);
}

export async function getReferralLoopStats(): Promise<ReferralLoopStats | null> {
    if (!sql) return null;

    try {
        const result = await sql`
            WITH events AS (
                SELECT
                    COUNT(*) FILTER (WHERE event_type = 'impression')::int AS impressions,
                    COUNT(*) FILTER (WHERE event_type = 'click')::int AS clicks
                FROM growth_referral_events
                WHERE occurred_at >= NOW() - INTERVAL '90 days'
            ),
            referred_accounts AS (
                SELECT ga.account_id
                FROM growth_attributions ga
                JOIN accounts a ON a.id = ga.account_id
                WHERE ga.medium = 'product_referral'
                  AND a.role = 'user'
                  AND a.created_at >= NOW() - INTERVAL '90 days'
            ),
            activated_accounts AS (
                SELECT DISTINCT account_id
                FROM requests
                WHERE status = 'submitted'
                  AND deleted_at IS NULL
                  AND COALESCE(is_demo, FALSE) = FALSE
            )
            SELECT
                e.impressions,
                e.clicks,
                (SELECT COUNT(*)::int FROM referred_accounts) AS signups,
                (
                    SELECT COUNT(*)::int
                    FROM referred_accounts ra
                    JOIN activated_accounts aa ON aa.account_id = ra.account_id
                ) AS activated
            FROM events e
        `;

        return toReferralLoopStats(result[0] || {});
    } catch (error) {
        // The growth_referral_events table may not exist until its migration runs;
        // the admin dashboard should render without this panel rather than fail.
        console.error('Failed to load referral loop stats:', error);
        return null;
    }
}
