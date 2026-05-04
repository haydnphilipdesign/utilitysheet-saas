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
};

export type ActivationFunnelStats = {
    totalAccounts: number;
    dashboardReady: number;
    onboardingCompleted: number;
    hasRequest: number;
    sellerLinkReady: number;
    noOnboardingNoRequest: number;
    missingDefaults: number;
    dashboardReadyRate: number;
    onboardingCompletionRate: number;
    firstRequestRate: number;
    inactiveRate: number;
};

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

    return {
        totalAccounts,
        dashboardReady,
        onboardingCompleted,
        hasRequest,
        sellerLinkReady,
        noOnboardingNoRequest,
        missingDefaults,
        dashboardReadyRate: percent(dashboardReady, totalAccounts),
        onboardingCompletionRate: percent(onboardingCompleted, totalAccounts),
        firstRequestRate: percent(hasRequest, totalAccounts),
        inactiveRate: percent(noOnboardingNoRequest, totalAccounts),
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
            )::int AS missing_defaults
        FROM accounts a
        LEFT JOIN request_counts rc ON rc.account_id = a.id
        LEFT JOIN default_counts dc ON dc.account_id = a.id
        WHERE a.role = 'user'
    `;

    return toActivationFunnelStats(result[0] || {});
}
