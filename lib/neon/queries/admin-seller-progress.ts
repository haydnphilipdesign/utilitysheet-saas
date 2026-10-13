import 'server-only';
import { requireAdmin } from '@/lib/admin';
import { sql } from '@/lib/neon/db';

export type LastEventRow = {
    request_id: string;
    property_address: string;
    account_id: string | null;
    user_name: string | null;
    user_email: string | null;
    request_created_at: string;
    last_event_type: string | null;
    last_event_data: Record<string, unknown> | null;
    last_event_at: string | null;
    hours_since_last_event: number | null;
    last_other_event_type: string | null;
    last_other_event_at: string | null;
    is_reopened: boolean | null;
    /** Browser-reported, advisory. Null when no step view was recorded in this editing session. */
    last_step: string | null;
    last_step_category: string | null;
    last_step_at: string | null;
    last_failure_code: string | null;
    last_failure_at: string | null;
    browser_sessions: number;
};

export type SellerProgressData = {
    totalRequests: number;
    inProgressCount: number;
    unknownActivity: number;
    active24h: number;
    inactive1To7d: number;
    inactiveOver7d: number;
    byLastEvent: Array<{ event_type: string; count: number }>;
    byLastCategory: Array<{ category: string; count: number }>;
    /** In-progress requests with at least one browser step view in the current editing session. */
    browserObserved: number;
    /** One row per request, by the last step its browser reported viewing. */
    byLastStep: Array<{ step: string; category: string | null; count: number }>;
    rows: LastEventRow[];
};

/**
 * Retained customer requests only. Endpoint events and browser-reported
 * diagnostics are both advisory; test-drive requests are outside this population.
 */
export async function getSellerProgressData(): Promise<SellerProgressData | null> {
    await requireAdmin();
    if (!sql) return null;
    const result = await sql`
        WITH live AS (
            SELECT r.id, r.account_id, r.status, r.created_at, r.metered_at, r.seller_edit_version,
                r.property_address, a.full_name AS user_name, a.email AS user_email
            FROM requests r JOIN accounts a ON a.id = r.account_id AND a.role = 'user'
            WHERE r.deleted_at IS NULL AND COALESCE(r.is_demo, FALSE) = FALSE
        ), progress AS (
            SELECT r.*,
                se.event_type AS last_event_type, se.event_data AS last_event_data,
                se.created_at AS last_event_at,
                oe.event_type AS last_other_event_type, oe.created_at AS last_other_event_at,
                sc.event_data AS category_data,
                bs.step AS last_step, bs.category AS last_step_category, bs.created_at AS last_step_at,
                bf.error_code AS last_failure_code, bf.created_at AS last_failure_at,
                COALESCE(bc.sessions, 0) AS browser_sessions
            FROM live r
            LEFT JOIN LATERAL (
                SELECT MAX(e.created_at) AS reopened_at FROM event_logs e
                WHERE e.request_id = r.id AND e.event_type = 'request_reopened'
            ) cycle ON TRUE
            LEFT JOIN LATERAL (
                SELECT e.event_type, e.created_at,
                    jsonb_build_object('categories', (
                        SELECT COALESCE(jsonb_agg(category), '[]'::jsonb) FROM (
                            SELECT DISTINCT category FROM jsonb_array_elements_text(
                                CASE WHEN jsonb_typeof(e.event_data->'categories') = 'array'
                                THEN e.event_data->'categories' ELSE '[]'::jsonb END
                            ) AS category
                            WHERE category IN ('electric','gas','propane','oil','water','sewer','trash','internet','cable')
                        ) allowed
                    ), 'category', CASE WHEN e.event_data->>'category' IN
                        ('electric','gas','propane','oil','water','sewer','trash','internet','cable')
                        THEN e.event_data->>'category' END,
                    'step', CASE WHEN e.event_data->>'step' IN ('welcome','home_basics','utility','advanced','review','success') THEN e.event_data->>'step' END,
                    'error_code', CASE WHEN e.event_data->>'error_code' IN
                        ('validation','already_submitted','stale_session','conflict','rate_limited','unavailable','not_found','forbidden','server_error','offline','network','unknown')
                        THEN e.event_data->>'error_code' END) AS event_data
                FROM event_logs e WHERE e.request_id = r.id
                    AND e.event_type IN ('seller_opened','suggestions_fetched','suggestions_search','seller_self_send_link',
                        'seller_step_viewed','seller_step_completed','seller_submission_attempted','seller_submission_failed','seller_suggestions_rendered','seller_suggestions_failed')
                    AND e.created_at >= COALESCE(cycle.reopened_at, r.created_at)
                    AND (e.event_data->>'actor' IS DISTINCT FROM 'seller_browser' OR e.event_data->>'edit_version' = r.seller_edit_version::text)
                ORDER BY e.created_at DESC, e.id DESC LIMIT 1
            ) se ON TRUE
            LEFT JOIN LATERAL (
                SELECT e.event_type, e.created_at FROM event_logs e WHERE e.request_id = r.id
                    AND e.event_type NOT IN ('seller_opened','suggestions_fetched','suggestions_search','seller_self_send_link',
                        'seller_step_viewed','seller_step_completed','seller_submission_attempted','seller_submission_failed','seller_suggestions_rendered','seller_suggestions_failed')
                ORDER BY e.created_at DESC, e.id DESC LIMIT 1
            ) oe ON TRUE
            LEFT JOIN LATERAL (
                SELECT e.event_data FROM event_logs e WHERE e.request_id = r.id
                    AND e.event_type = 'suggestions_fetched'
                    AND e.created_at >= COALESCE(cycle.reopened_at, r.created_at)
                ORDER BY e.created_at DESC, e.id DESC LIMIT 1
            ) sc ON TRUE
            -- Last step the browser reported: the most recently heard-from tab session, then its
            -- highest sequence, so a late or repeated batch cannot move the seller backwards.
            LEFT JOIN LATERAL (
                SELECT v.step, v.category, v.created_at FROM (
                    SELECT e.event_data->>'step' AS step,
                        CASE WHEN e.event_data->>'category' IN ('electric','gas','propane','oil','water','sewer','trash','internet','cable')
                            THEN e.event_data->>'category' END AS category,
                        e.created_at,
                        CASE WHEN e.event_data->>'seq' ~ '^[0-9]{1,6}$' THEN (e.event_data->>'seq')::int ELSE 0 END AS seq,
                        MAX(e.created_at) OVER (PARTITION BY e.event_data->>'session_id') AS session_last
                    FROM event_logs e WHERE e.request_id = r.id
                        AND e.event_type = 'seller_step_viewed'
                        AND e.event_data->>'step' IN ('welcome','home_basics','utility','advanced','review','success')
                        AND e.created_at >= COALESCE(cycle.reopened_at, r.created_at)
                        AND (e.event_data->>'actor' IS DISTINCT FROM 'seller_browser' OR e.event_data->>'edit_version' = r.seller_edit_version::text)
                ) v ORDER BY v.session_last DESC, v.seq DESC, v.created_at DESC LIMIT 1
            ) bs ON TRUE
            LEFT JOIN LATERAL (
                SELECT e.event_data->>'error_code' AS error_code, e.created_at FROM event_logs e
                WHERE e.request_id = r.id AND e.event_type = 'seller_submission_failed'
                    AND e.event_data->>'error_code' IN
                        ('validation','already_submitted','stale_session','conflict','rate_limited','unavailable','not_found','forbidden','server_error','offline','network','unknown')
                    AND e.created_at >= COALESCE(cycle.reopened_at, r.created_at)
                    AND (e.event_data->>'actor' IS DISTINCT FROM 'seller_browser' OR e.event_data->>'edit_version' = r.seller_edit_version::text)
                ORDER BY e.created_at DESC, e.id DESC LIMIT 1
            ) bf ON TRUE
            LEFT JOIN LATERAL (
                SELECT COUNT(DISTINCT e.event_data->>'session_id')::int AS sessions FROM event_logs e
                WHERE e.request_id = r.id
                    AND e.event_type IN ('seller_step_viewed','seller_step_completed','seller_submission_attempted','seller_submission_failed','seller_suggestions_rendered','seller_suggestions_failed')
                    AND e.created_at >= COALESCE(cycle.reopened_at, r.created_at)
                    AND (e.event_data->>'actor' IS DISTINCT FROM 'seller_browser' OR e.event_data->>'edit_version' = r.seller_edit_version::text)
            ) bc ON TRUE
            WHERE r.status = 'in_progress'
        ), stages AS (
            SELECT COALESCE(last_event_type, 'unknown') AS event_type, COUNT(*)::int AS count
            FROM progress GROUP BY COALESCE(last_event_type, 'unknown')
        ), categories AS (
            SELECT category, COUNT(*)::int AS count FROM progress p
            CROSS JOIN LATERAL (
                SELECT DISTINCT category FROM jsonb_array_elements_text(
                    CASE WHEN jsonb_typeof(p.category_data->'categories') = 'array'
                    THEN p.category_data->'categories' ELSE '[]'::jsonb END
                ) AS category
                WHERE category IN ('electric','gas','propane','oil','water','sewer','trash','internet','cable')
            ) c GROUP BY category
        ), steps AS (
            SELECT last_step AS step, last_step_category AS category, COUNT(*)::int AS count
            FROM progress WHERE last_step IS NOT NULL GROUP BY last_step, last_step_category
        ), details AS (
            SELECT id AS request_id, property_address, account_id,
                user_name, user_email, created_at AS request_created_at,
                last_event_type, last_event_data, last_event_at, last_other_event_type, last_other_event_at,
                EXTRACT(EPOCH FROM (NOW() - last_event_at)) / 3600.0 AS hours_since_last_event,
                (metered_at IS NOT NULL AND seller_edit_version > 0) AS is_reopened,
                last_step, last_step_category, last_step_at, last_failure_code, last_failure_at, browser_sessions
            FROM progress ORDER BY last_event_at DESC NULLS LAST, created_at DESC, id LIMIT 200
        )
        SELECT (SELECT COUNT(*)::int FROM live) AS "totalRequests",
            COUNT(*)::int AS "inProgressCount",
            COUNT(*) FILTER (WHERE last_event_at IS NULL)::int AS "unknownActivity",
            COUNT(*) FILTER (WHERE last_event_at >= NOW() - INTERVAL '24 hours')::int AS "active24h",
            COUNT(*) FILTER (WHERE last_event_at < NOW() - INTERVAL '24 hours' AND last_event_at >= NOW() - INTERVAL '7 days')::int AS "inactive1To7d",
            COUNT(*) FILTER (WHERE last_event_at < NOW() - INTERVAL '7 days')::int AS "inactiveOver7d",
            (SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY count DESC, event_type), '[]'::jsonb) FROM stages s) AS "byLastEvent",
            (SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY count DESC, category), '[]'::jsonb) FROM categories c) AS "byLastCategory",
            COUNT(*) FILTER (WHERE last_step IS NOT NULL)::int AS "browserObserved",
            (SELECT COALESCE(jsonb_agg(to_jsonb(st) ORDER BY count DESC, step, category), '[]'::jsonb) FROM steps st) AS "byLastStep",
            (SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY last_event_at DESC NULLS LAST, request_created_at DESC, request_id), '[]'::jsonb) FROM details d) AS rows
        FROM progress
    `;
    return result[0] as SellerProgressData;
}
