import 'server-only';

import { sql } from '@/lib/neon/db';

/**
 * Figures for the `/admin` business strip and recent-activity lists.
 *
 * These are deliberately separate from `lib/admin/activation-funnel.ts`: the funnel answers
 * "how far along the product are accounts", this answers "how big is this and what happened
 * this week". Both are computed over `role = 'user'` accounts so the two agree.
 */

type OperationsSummaryRow = {
    total_accounts?: number | string | null;
    signups_last_7d?: number | string | null;
    signups_prev_7d?: number | string | null;
    pro_accounts?: number | string | null;
    team_accounts?: number | string | null;
    paid_accounts?: number | string | null;
};

type RequestVolumeRow = {
    total_requests?: number | string | null;
    created_last_7d?: number | string | null;
    created_prev_7d?: number | string | null;
    submitted_last_7d?: number | string | null;
    stale_in_progress?: number | string | null;
};

export type OperationsSummary = {
    totalAccounts: number;
    signupsLast7d: number;
    signupsPrev7d: number;
    proAccounts: number;
    teamAccounts: number;
    paidAccounts: number;
    paidRate: number;
};

export type RequestVolume = {
    totalRequests: number;
    createdLast7d: number;
    createdPrev7d: number;
    submittedLast7d: number;
    staleInProgress: number;
};

export type RequestStatusBreakdown = {
    status: string;
    count: number;
};

export type RecentRequestSummary = {
    id: string;
    accountId: string | null;
    propertyAddress: string;
    status: string;
    createdAt: string;
    userName: string | null;
    userEmail: string | null;
};

export type RecentSignupSummary = {
    id: string;
    name: string | null;
    email: string | null;
    createdAt: string;
    plan: string | null;
    requestCount: number;
    submittedCount: number;
};

function asCount(value: number | string | null | undefined) {
    return Number(value || 0);
}

function percent(part: number, total: number) {
    if (total <= 0) return 0;
    return Math.round((part / total) * 100);
}

export function toOperationsSummary(row: OperationsSummaryRow): OperationsSummary {
    const totalAccounts = asCount(row.total_accounts);
    const paidAccounts = asCount(row.paid_accounts);

    return {
        totalAccounts,
        signupsLast7d: asCount(row.signups_last_7d),
        signupsPrev7d: asCount(row.signups_prev_7d),
        proAccounts: asCount(row.pro_accounts),
        teamAccounts: asCount(row.team_accounts),
        paidAccounts,
        paidRate: percent(paidAccounts, totalAccounts),
    };
}

export function toRequestVolume(row: RequestVolumeRow): RequestVolume {
    return {
        totalRequests: asCount(row.total_requests),
        createdLast7d: asCount(row.created_last_7d),
        createdPrev7d: asCount(row.created_prev_7d),
        submittedLast7d: asCount(row.submitted_last_7d),
        staleInProgress: asCount(row.stale_in_progress),
    };
}

/**
 * Renders a period-over-period change as short label text. Returns null when there is no
 * prior period to compare against, so the caller shows the count alone rather than a
 * meaningless "+100%".
 */
export function formatDelta(current: number, previous: number): string | null {
    if (previous <= 0) return null;
    const change = percent(current - previous, previous);
    if (change === 0) return 'flat vs prior 7d';
    return `${change > 0 ? '+' : ''}${change}% vs prior 7d`;
}

export async function getOperationsSummary(): Promise<OperationsSummary | null> {
    if (!sql) return null;

    // `paid_accounts` intentionally mirrors the `paid_accounts` predicate in
    // `lib/admin/activation-funnel.ts` and the `plan=paying` list filter: a Pro entitlement
    // override, or an active workspace on Team billing.
    const result = await sql`
        SELECT
            COUNT(*)::int AS total_accounts,
            COUNT(*) FILTER (WHERE a.created_at >= NOW() - INTERVAL '7 days')::int AS signups_last_7d,
            COUNT(*) FILTER (
                WHERE a.created_at < NOW() - INTERVAL '7 days'
                  AND a.created_at >= NOW() - INTERVAL '14 days'
            )::int AS signups_prev_7d,
            COUNT(*) FILTER (WHERE a.subscription_status = 'pro')::int AS pro_accounts,
            COUNT(*) FILTER (
                WHERE EXISTS (
                    SELECT 1
                    FROM organizations paid_org
                    WHERE paid_org.id = a.active_organization_id
                      AND paid_org.subscription_status = 'team'
                )
            )::int AS team_accounts,
            COUNT(*) FILTER (
                WHERE a.subscription_status = 'pro' OR EXISTS (
                    SELECT 1
                    FROM organizations paid_org
                    WHERE paid_org.id = a.active_organization_id
                      AND paid_org.subscription_status = 'team'
                )
            )::int AS paid_accounts
        FROM accounts a
        WHERE a.role = 'user'
    `;

    return toOperationsSummary(result[0] || {});
}

export async function getRequestVolume(): Promise<RequestVolume | null> {
    if (!sql) return null;

    // Demo requests are excluded from the stale count so this agrees with `/admin/abandonment`,
    // which excludes them throughout. `total_requests` counts every lifecycle row, matching the
    // lifecycle breakdown rendered beside it.
    const result = await sql`
        SELECT
            COUNT(*)::int AS total_requests,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS created_last_7d,
            COUNT(*) FILTER (
                WHERE created_at < NOW() - INTERVAL '7 days'
                  AND created_at >= NOW() - INTERVAL '14 days'
            )::int AS created_prev_7d,
            COUNT(*) FILTER (
                WHERE status = 'submitted'
                  AND COALESCE(metered_at, last_activity_at, created_at) >= NOW() - INTERVAL '7 days'
            )::int AS submitted_last_7d,
            COUNT(*) FILTER (
                WHERE status = 'in_progress'
                  AND COALESCE(is_demo, FALSE) = FALSE
                  AND COALESCE(last_activity_at, created_at) < NOW() - INTERVAL '7 days'
            )::int AS stale_in_progress
        FROM requests
    `;

    return toRequestVolume(result[0] || {});
}

export async function getRequestStatusBreakdown(): Promise<RequestStatusBreakdown[]> {
    if (!sql) return [];

    const result = await sql`
        SELECT status, COUNT(*)::int AS count
        FROM requests
        GROUP BY status
        ORDER BY status ASC
    `;

    return result.map((row) => ({
        status: String(row.status || 'unknown'),
        count: asCount(row.count),
    }));
}

export async function getRecentRequests(limit = 12): Promise<RecentRequestSummary[]> {
    if (!sql) return [];

    const result = await sql`
        SELECT
            r.id,
            r.account_id,
            r.created_at,
            r.status,
            r.property_address,
            a.full_name,
            a.email
        FROM requests r
        LEFT JOIN accounts a ON r.account_id = a.id
        ORDER BY r.created_at DESC
        LIMIT ${limit}
    `;

    return result.map((row) => ({
        id: String(row.id),
        accountId: row.account_id ? String(row.account_id) : null,
        propertyAddress: row.property_address ? String(row.property_address) : 'No address',
        status: String(row.status || 'draft'),
        createdAt: String(row.created_at),
        userName: row.full_name ? String(row.full_name) : null,
        userEmail: row.email ? String(row.email) : null,
    }));
}

/**
 * Newest customer accounts with just enough context to tell a real signup from a
 * name on a list: has this account created anything, and has a seller ever finished.
 */
export async function getRecentSignups(limit = 8): Promise<RecentSignupSummary[]> {
    if (!sql) return [];

    const result = await sql`
        SELECT
            a.id,
            a.full_name,
            a.email,
            a.created_at,
            a.subscription_status,
            COALESCE(rc.request_count, 0)::int AS request_count,
            COALESCE(rc.submitted_count, 0)::int AS submitted_count
        FROM accounts a
        LEFT JOIN (
            SELECT
                account_id,
                COUNT(*)::int AS request_count,
                COUNT(*) FILTER (WHERE status = 'submitted')::int AS submitted_count
            FROM requests
            WHERE deleted_at IS NULL
              AND COALESCE(is_demo, FALSE) = FALSE
            GROUP BY account_id
        ) rc ON rc.account_id = a.id
        WHERE a.role = 'user'
        ORDER BY a.created_at DESC
        LIMIT ${limit}
    `;

    return result.map((row) => ({
        id: String(row.id),
        name: row.full_name ? String(row.full_name) : null,
        email: row.email ? String(row.email) : null,
        createdAt: String(row.created_at),
        plan: row.subscription_status ? String(row.subscription_status) : null,
        requestCount: asCount(row.request_count),
        submittedCount: asCount(row.submitted_count),
    }));
}
