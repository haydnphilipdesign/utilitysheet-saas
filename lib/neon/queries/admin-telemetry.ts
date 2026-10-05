import 'server-only';

import { requireAdmin } from '@/lib/admin';
import { sql } from '@/lib/neon/db';

export function telemetryDays(value: string | string[] | undefined): 7 | 30 | 90 {
    return value === '7' ? 7 : value === '90' ? 90 : 30;
}

export type FormTelemetry = {
    accounts: number;
    formAccounts: number;
    multiFormAccounts: number;
    forms: number;
    activeForms: number;
    requests: number;
    attributedRequests: number;
    completedRequests: number;
    usedForms: number;
    multiFormUsers: number;
};
export type EventTelemetry = { event: string; count: number; requests: number };
export type AiTelemetry = { feature: string; status: string; runs: number; cached: number; freshLatencyMs: number | null };

export type UsageTelemetry = {
    created: number; opened: number; completed: number; completedWithoutOpen: number;
    medianHours: number | null; timedCompletions: number;
    intake: number; agent: number; unknownSource: number; simple: number; advanced: number;
    reminded: number; completedAfterReminder: number; returnLinks: number; edited: number;
    currentAccounts: number; previousAccounts: number; returningAccounts: number;
    testDriveAccounts: number; convertedTestDriveAccounts: number;
    modules: { module: string; requests: number }[];
    providers: { category: string; total: number; suggested: number; searched: number; manual: number; unknown: number; unclassified: number; notApplicable: number }[];
};

// Called only after getAdminTelemetry has authorized the caller. Select only allowlisted
// creation metadata; event_data can contain addresses and must never be returned wholesale.
async function getUsageTelemetry(days: number): Promise<UsageTelemetry> {
    const rows = await sql!`
        WITH live AS (
            SELECT r.id, r.account_id, r.created_at, r.metered_at, r.packet_mode, r.advanced_modules
            FROM requests r JOIN accounts a ON a.id = r.account_id AND a.role = 'user'
            WHERE r.deleted_at IS NULL AND COALESCE(r.is_demo, FALSE) = FALSE
        ), cohort AS (
            SELECT * FROM live WHERE created_at >= NOW() - ${days} * INTERVAL '1 day'
        ), observations AS (
            SELECT r.id,
                MIN(e.created_at) FILTER (WHERE e.event_type = 'seller_opened' AND e.created_at >= r.created_at) AS first_open,
                MIN(e.created_at) FILTER (WHERE e.event_type = 'reminder_sent' AND e.created_at >= r.created_at) AS first_reminder,
                BOOL_OR(e.event_type = 'seller_self_send_link') AS return_link,
                BOOL_OR(e.event_type = 'submitted_sheet_edited' AND e.created_at >= r.metered_at) AS edited
            FROM cohort r LEFT JOIN event_logs e ON e.request_id = r.id
            GROUP BY r.id
        ), creation AS (
            SELECT DISTINCT ON (e.request_id) e.request_id,
                CASE WHEN e.event_data->>'source' = 'intake_link' THEN 'intake'
                     WHEN e.event_data->>'actor' = 'agent' THEN 'agent' ELSE 'unknown' END AS channel
            FROM event_logs e JOIN cohort r ON r.id = e.request_id
            WHERE e.event_type = 'request_created'
            ORDER BY e.request_id, e.created_at, e.id
        ), current_accounts AS (
            SELECT DISTINCT account_id FROM cohort
        ), previous_accounts AS (
            SELECT DISTINCT account_id FROM live
            WHERE created_at >= NOW() - ${days * 2} * INTERVAL '1 day'
                AND created_at < NOW() - ${days} * INTERVAL '1 day'
        ), test_completions AS (
            SELECT r.account_id, MIN(e.created_at) AS completed_at
            FROM requests r JOIN accounts a ON a.id = r.account_id AND a.role = 'user'
            JOIN event_logs e ON e.request_id = r.id AND e.event_type = 'seller_submitted'
            WHERE r.is_demo = TRUE AND r.deleted_at IS NULL
                AND EXISTS (SELECT 1 FROM event_logs c WHERE c.request_id = r.id
                    AND c.event_type = 'request_created' AND c.event_data->>'source' = 'self_serve_test_drive')
            GROUP BY r.account_id
        ), tests_in_window AS (
            SELECT * FROM test_completions WHERE completed_at >= NOW() - ${days} * INTERVAL '1 day'
        ), modules AS (
            SELECT module, COUNT(DISTINCT r.id)::int AS requests
            FROM cohort r CROSS JOIN LATERAL unnest(r.advanced_modules) AS module
            WHERE r.packet_mode = 'advanced'
            GROUP BY module
        ), providers AS (
            SELECT u.category, COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE u.entry_mode = 'suggested_confirmed')::int AS suggested,
                COUNT(*) FILTER (WHERE u.entry_mode = 'search_selected')::int AS searched,
                COUNT(*) FILTER (WHERE u.entry_mode = 'free_text')::int AS manual,
                COUNT(*) FILTER (WHERE u.entry_mode = 'unknown')::int AS unknown,
                COUNT(*) FILTER (WHERE u.entry_mode IS NULL)::int AS unclassified,
                COUNT(*) FILTER (WHERE u.entry_mode = 'not_applicable')::int AS "notApplicable"
            FROM utility_entries u JOIN live r ON r.id = u.request_id
            WHERE r.metered_at >= NOW() - ${days} * INTERVAL '1 day'
            GROUP BY u.category
        )
        SELECT COUNT(*)::int AS created,
            COUNT(*) FILTER (WHERE o.first_open IS NOT NULL)::int AS opened,
            COUNT(*) FILTER (WHERE r.metered_at IS NOT NULL)::int AS completed,
            COUNT(*) FILTER (WHERE r.metered_at IS NOT NULL AND o.first_open IS NULL)::int AS "completedWithoutOpen",
            (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (r.metered_at - o.first_open)) / 3600)
                FILTER (WHERE r.metered_at >= o.first_open))::float8 AS "medianHours",
            COUNT(*) FILTER (WHERE r.metered_at >= o.first_open)::int AS "timedCompletions",
            COUNT(*) FILTER (WHERE c.channel = 'intake')::int AS intake,
            COUNT(*) FILTER (WHERE c.channel = 'agent')::int AS agent,
            COUNT(*) FILTER (WHERE c.channel IS NULL OR c.channel = 'unknown')::int AS "unknownSource",
            COUNT(*) FILTER (WHERE r.packet_mode = 'simple')::int AS simple,
            COUNT(*) FILTER (WHERE r.packet_mode = 'advanced')::int AS advanced,
            COUNT(*) FILTER (WHERE o.first_reminder IS NOT NULL)::int AS reminded,
            COUNT(*) FILTER (WHERE r.metered_at > o.first_reminder)::int AS "completedAfterReminder",
            COUNT(*) FILTER (WHERE o.return_link)::int AS "returnLinks",
            COUNT(*) FILTER (WHERE o.edited)::int AS edited,
            (SELECT COUNT(*)::int FROM current_accounts) AS "currentAccounts",
            (SELECT COUNT(*)::int FROM previous_accounts) AS "previousAccounts",
            (SELECT COUNT(*)::int FROM current_accounts c JOIN previous_accounts p USING(account_id)) AS "returningAccounts",
            (SELECT COUNT(*)::int FROM tests_in_window) AS "testDriveAccounts",
            (SELECT COUNT(*)::int FROM tests_in_window t WHERE EXISTS (
                SELECT 1 FROM live l WHERE l.account_id = t.account_id AND l.metered_at > t.completed_at
            )) AS "convertedTestDriveAccounts",
            (SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.requests DESC, m.module), '[]'::jsonb) FROM modules m) AS modules,
            (SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.category), '[]'::jsonb) FROM providers p) AS providers
        FROM cohort r LEFT JOIN observations o ON o.id = r.id LEFT JOIN creation c ON c.request_id = r.id
    `;
    return rows[0] as UsageTelemetry;
}

/** Authorize here as well as in the layout: server components can render independently. */
export async function getAdminTelemetry(days: 7 | 30 | 90) {
    await requireAdmin();
    if (!sql) return null;
    // Enforce the bound at runtime too, rather than trusting only the TS caller.
    const windowDays = telemetryDays(String(days));
    const [formRows, eventRows, aiRows, usage] = await Promise.all([
        sql`
            WITH customers AS (
                SELECT id FROM accounts WHERE role = 'user'
            ), form_scopes AS (
                SELECT f.account_id, f.organization_id, COUNT(*) AS forms,
                    COUNT(*) FILTER (WHERE f.is_active) AS active_forms
                FROM intake_links f JOIN customers a ON a.id = f.account_id
                GROUP BY f.account_id, f.organization_id
            ), cohort AS (
                SELECT r.account_id, r.organization_id, r.source_form_id, r.metered_at
                FROM requests r JOIN customers a ON a.id = r.account_id
                WHERE r.deleted_at IS NULL AND COALESCE(r.is_demo, FALSE) = FALSE
                    AND r.created_at >= NOW() - ${windowDays} * INTERVAL '1 day'
            ), used_scopes AS (
                SELECT account_id, organization_id, COUNT(DISTINCT source_form_id) AS forms
                FROM cohort WHERE source_form_id IS NOT NULL
                GROUP BY account_id, organization_id
            )
            SELECT
                (SELECT COUNT(*) FROM customers) AS accounts,
                (SELECT COUNT(DISTINCT account_id) FROM form_scopes) AS form_accounts,
                (SELECT COUNT(DISTINCT account_id) FROM form_scopes WHERE forms > 1) AS multi_form_accounts,
                (SELECT COALESCE(SUM(forms), 0) FROM form_scopes) AS forms,
                (SELECT COALESCE(SUM(active_forms), 0) FROM form_scopes) AS active_forms,
                (SELECT COUNT(*) FROM cohort) AS requests,
                (SELECT COUNT(*) FROM cohort WHERE source_form_id IS NOT NULL) AS attributed_requests,
                (SELECT COUNT(*) FROM cohort WHERE source_form_id IS NOT NULL AND metered_at IS NOT NULL) AS completed_requests,
                (SELECT COUNT(DISTINCT source_form_id) FROM cohort) AS used_forms,
                (SELECT COUNT(DISTINCT account_id) FROM used_scopes WHERE forms > 1) AS multi_form_users
        `,
        sql`
            SELECT e.event_type AS event, COUNT(*) AS count, COUNT(DISTINCT e.request_id) AS requests
            FROM event_logs e
            JOIN requests r ON r.id = e.request_id
            JOIN accounts a ON a.id = r.account_id AND a.role = 'user'
            WHERE e.created_at >= NOW() - ${windowDays} * INTERVAL '1 day'
                AND r.deleted_at IS NULL AND COALESCE(r.is_demo, FALSE) = FALSE
            GROUP BY e.event_type ORDER BY count DESC, e.event_type LIMIT 50
        `,
        sql`
            SELECT g.feature, g.status, COUNT(*) AS runs,
                COUNT(*) FILTER (WHERE g.cache_hit) AS cached,
                ROUND(AVG(g.latency_ms) FILTER (WHERE g.cache_hit = FALSE)) AS fresh_latency_ms
            FROM ai_generation_runs g
            JOIN requests r ON r.id = g.request_id
            JOIN accounts a ON a.id = r.account_id AND a.role = 'user'
            WHERE g.created_at >= NOW() - ${windowDays} * INTERVAL '1 day'
                AND r.deleted_at IS NULL AND COALESCE(r.is_demo, FALSE) = FALSE
            GROUP BY g.feature, g.status ORDER BY g.feature, g.status
        `,
        getUsageTelemetry(windowDays),
    ]);
    const row = formRows[0];
    const forms: FormTelemetry = {
        accounts: Number(row.accounts), formAccounts: Number(row.form_accounts),
        multiFormAccounts: Number(row.multi_form_accounts), forms: Number(row.forms),
        activeForms: Number(row.active_forms), requests: Number(row.requests),
        attributedRequests: Number(row.attributed_requests), completedRequests: Number(row.completed_requests),
        usedForms: Number(row.used_forms), multiFormUsers: Number(row.multi_form_users),
    };
    return {
        days: windowDays, forms, usage,
        events: eventRows.map((e) => ({ event: String(e.event), count: Number(e.count), requests: Number(e.requests) })) as EventTelemetry[],
        ai: aiRows.map((g) => ({ feature: String(g.feature), status: String(g.status), runs: Number(g.runs), cached: Number(g.cached), freshLatencyMs: g.fresh_latency_ms == null ? null : Number(g.fresh_latency_ms) })) as AiTelemetry[],
    };
}
