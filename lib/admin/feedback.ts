import { sql } from '@/lib/neon/db';
import { getStatementExecutor, isMissingRelationError, type StatementExecutor } from '@/lib/neon/statements';
import type { AdminActor } from '@/lib/neon/queries/admin-writes';
import type { FeedbackCategory, FeedbackStatus } from '@/lib/feedback/constants';

/*
 * Reads and reviews the `feedback_submissions` table written by the dashboard
 * Feedback dialog (`.ai/plans/2026-10-05-feedback-inbox.md`).
 *
 * `message` is customer free text and may carry personal details. It must
 * never reach a log line, an analytics event, audit metadata, or an AI
 * provider call.
 */

export const FEEDBACK_ROW_LIMIT = 200;

export type FeedbackRow = {
    id: string;
    category: FeedbackCategory;
    message: string;
    page_path: string | null;
    viewport: string | null;
    user_agent: string | null;
    email_status: 'pending' | 'sent' | 'failed';
    status: FeedbackStatus;
    note: string | null;
    version: number;
    status_changed_at: string | null;
    created_at: string;
    account_id: string | null;
    user_name: string | null;
    user_email: string | null;
    is_paid: boolean | null;
    updated_by_email: string | null;
};

export type FeedbackInbox =
    | { installed: false }
    | {
        installed: true;
        total: number;
        newCount: number;
        last30d: number;
        accounts: number;
        emailFailed: number;
        rows: FeedbackRow[];
    };

function asCount(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

/** Returns null when no database is configured, and `installed: false` while the migration is pending. */
export async function getFeedbackInbox(filters: {
    status: FeedbackStatus | null;
    category: FeedbackCategory | null;
}): Promise<FeedbackInbox | null> {
    if (!sql) return null;

    try {
        // `is_paid` mirrors the `paid_accounts` predicate in
        // `lib/admin/operations-overview.ts` so Admin surfaces do not disagree.
        const [totalsRes, rowsRes] = await Promise.all([
            sql`
                SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE status = 'new')::int AS new_count,
                    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS last_30d,
                    COUNT(DISTINCT account_id)::int AS accounts,
                    COUNT(*) FILTER (WHERE email_status = 'failed')::int AS email_failed
                FROM feedback_submissions
            `,
            sql`
                SELECT
                    f.id,
                    f.category,
                    f.message,
                    f.page_path,
                    f.viewport,
                    f.user_agent,
                    f.email_status,
                    f.status,
                    f.note,
                    f.version,
                    f.status_changed_at,
                    f.created_at,
                    f.account_id,
                    a.full_name AS user_name,
                    a.email AS user_email,
                    (
                        a.subscription_status = 'pro' OR EXISTS (
                            SELECT 1
                            FROM organizations paid_org
                            WHERE paid_org.id = a.active_organization_id
                              AND paid_org.subscription_status = 'team'
                        )
                    ) AS is_paid,
                    reviewer.email AS updated_by_email
                FROM feedback_submissions f
                LEFT JOIN accounts a ON a.id = f.account_id
                LEFT JOIN accounts reviewer ON reviewer.id = f.updated_by
                WHERE (${filters.status}::text IS NULL OR f.status = ${filters.status})
                  AND (${filters.category}::text IS NULL OR f.category = ${filters.category})
                ORDER BY f.created_at DESC
                LIMIT ${FEEDBACK_ROW_LIMIT}
            `,
        ]);

        const totals = (totalsRes[0] || {}) as Record<string, unknown>;
        return {
            installed: true,
            total: asCount(totals.total),
            newCount: asCount(totals.new_count),
            last30d: asCount(totals.last_30d),
            accounts: asCount(totals.accounts),
            emailFailed: asCount(totals.email_failed),
            rows: rowsRes as unknown as FeedbackRow[],
        };
    } catch (error) {
        if (isMissingRelationError(error)) return { installed: false };
        throw error;
    }
}

export type FeedbackWriteOutcome = 'OK' | 'STALE' | 'NOT_FOUND' | 'ACTOR_NOT_ADMIN';

/**
 * Changes the review status of one feedback item with optimistic concurrency.
 * The change and its audit entry are one statement, so a failed audit insert
 * rolls the change back. Neither the message nor the private note is copied
 * into the audit entry.
 */
export async function updateFeedbackStatus(input: {
    feedbackId: string;
    status: FeedbackStatus;
    expectedVersion: number;
    note: string | null;
    reason: string | null;
    actor: AdminActor;
    db?: StatementExecutor;
}): Promise<{ outcome: FeedbackWriteOutcome; version: number | null }> {
    const rows = await (input.db ?? getStatementExecutor()).run({
        text: `
            WITH actor AS (
                SELECT id FROM accounts WHERE id = $1::uuid AND role = 'admin'
            ),
            existing AS (
                SELECT id, status FROM feedback_submissions WHERE id = $2::uuid
            ),
            updated AS (
                UPDATE feedback_submissions f SET
                    status = $3::text,
                    note = COALESCE($4::text, f.note),
                    version = f.version + 1,
                    updated_by = actor.id,
                    status_changed_at = NOW()
                FROM actor
                WHERE f.id = $2::uuid AND f.version = $5::int
                RETURNING f.id, f.status, f.version, f.account_id
            ),
            audit AS (
                INSERT INTO admin_audit_logs (admin_id, target_user_id, action, metadata, ip_address)
                SELECT $1::uuid, u.account_id, 'feedback_status_changed',
                    $6::jsonb || jsonb_build_object(
                        'feedbackId', u.id,
                        'previousStatus', (SELECT status FROM existing),
                        'newStatus', u.status,
                        'noteChanged', $4::text IS NOT NULL
                    ),
                    $7::text
                FROM updated u
                RETURNING id
            )
            SELECT (SELECT version FROM updated) AS version,
                EXISTS (SELECT 1 FROM actor) AS actor_ok,
                EXISTS (SELECT 1 FROM existing) AS found,
                (SELECT COUNT(*) FROM audit)::int AS audit_count
        `,
        params: [
            input.actor.adminId,
            input.feedbackId,
            input.status,
            input.note,
            input.expectedVersion,
            JSON.stringify({
                ...(input.reason ? { reason: input.reason } : {}),
                ...(input.actor.userAgent ? { userAgent: input.actor.userAgent } : {}),
            }),
            input.actor.ipAddress,
        ],
    });
    const row = rows[0];
    if (!row?.actor_ok) return { outcome: 'ACTOR_NOT_ADMIN', version: null };
    if (!row.found) return { outcome: 'NOT_FOUND', version: null };
    if (row.version === null || row.version === undefined) return { outcome: 'STALE', version: null };
    return { outcome: 'OK', version: Number(row.version) };
}
