import { sql } from '@/lib/neon/db';

/*
 * Reads the `question_requests` table captured by the gap-capture slice
 * (`.ai/plans/2026-09-03-question-gap-capture.md`). Read-only: the admin
 * surface exists to answer whether requested questions concentrate on a short
 * list or form a varied long tail, and no write path is intended here.
 *
 * `requested_text` is customer free text and may carry codes or personal
 * details. It must never reach a log line, an analytics event, or an AI
 * provider call, per D5 of that plan and `docs/ai-telemetry.md`.
 */

export const QUESTION_REQUEST_ROW_LIMIT = 200;

export type QuestionRequestRow = {
    id: string;
    requested_text: string;
    context: string;
    packet_mode: string | null;
    status: string;
    created_at: string;
    account_id: string | null;
    user_name: string | null;
    user_email: string | null;
    is_paid: boolean | null;
};

export type QuestionRequestBreakdown = { key: string; count: number };

export type QuestionRequestSummary = {
    total: number;
    accounts: number;
    last30d: number;
    paidAccounts: number;
    freeAccounts: number;
    byContext: QuestionRequestBreakdown[];
    byPacketMode: QuestionRequestBreakdown[];
    rows: QuestionRequestRow[];
};

export const QUESTION_REQUEST_CONTEXT_LABELS: Record<string, string> = {
    settings: 'Settings',
    request_creation: 'Request creation',
};

export const QUESTION_REQUEST_PACKET_MODE_LABELS: Record<string, string> = {
    simple: 'Utility Sheet',
    advanced: 'Handoff Packet',
    unrecorded: 'Not recorded',
};

export function labelForQuestionRequestKey(labels: Record<string, string>, key: string): string {
    return labels[key] || key.replace(/_/g, ' ');
}

function asCount(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

export function toQuestionRequestBreakdown(rows: Record<string, unknown>[]): QuestionRequestBreakdown[] {
    return rows.map((row) => ({
        key: String(row.key ?? 'unknown'),
        count: asCount(row.count),
    }));
}

export function toQuestionRequestSummary(
    totals: Record<string, unknown>,
    byContext: Record<string, unknown>[],
    byPacketMode: Record<string, unknown>[],
    rows: QuestionRequestRow[]
): QuestionRequestSummary {
    const accounts = asCount(totals.accounts);
    const paidAccounts = asCount(totals.paid_accounts);

    return {
        total: asCount(totals.total),
        accounts,
        last30d: asCount(totals.last_30d),
        paidAccounts,
        // Clamped because the two counts come from separate aggregates; a
        // negative remainder would be a nonsense figure on the page.
        freeAccounts: Math.max(0, accounts - paidAccounts),
        byContext: toQuestionRequestBreakdown(byContext),
        byPacketMode: toQuestionRequestBreakdown(byPacketMode),
        rows,
    };
}

export async function getQuestionRequestSummary(): Promise<QuestionRequestSummary | null> {
    if (!sql) return null;

    // `paid_accounts` and the per-row `is_paid` intentionally mirror the
    // `paid_accounts` predicate in `lib/admin/operations-overview.ts`: a Pro
    // entitlement override, or an active workspace on Team billing. Whether
    // Free customers are represented is the point of this dataset, so the
    // two surfaces must not disagree.
    const [totalsRes, byContextRes, byPacketModeRes, rowsRes] = await Promise.all([
        sql`
            SELECT
                COUNT(*)::int AS total,
                COUNT(DISTINCT qr.account_id)::int AS accounts,
                COUNT(*) FILTER (WHERE qr.created_at >= NOW() - INTERVAL '30 days')::int AS last_30d,
                COUNT(DISTINCT qr.account_id) FILTER (
                    WHERE a.subscription_status = 'pro' OR EXISTS (
                        SELECT 1
                        FROM organizations paid_org
                        WHERE paid_org.id = a.active_organization_id
                          AND paid_org.subscription_status = 'team'
                    )
                )::int AS paid_accounts
            FROM question_requests qr
            LEFT JOIN accounts a ON a.id = qr.account_id
        `,
        sql`
            SELECT context AS key, COUNT(*)::int AS count
            FROM question_requests
            GROUP BY context
            ORDER BY count DESC
        `,
        sql`
            SELECT COALESCE(packet_mode, 'unrecorded') AS key, COUNT(*)::int AS count
            FROM question_requests
            GROUP BY COALESCE(packet_mode, 'unrecorded')
            ORDER BY count DESC
        `,
        sql`
            SELECT
                qr.id,
                qr.requested_text,
                qr.context,
                qr.packet_mode,
                qr.status,
                qr.created_at,
                qr.account_id,
                a.full_name AS user_name,
                a.email AS user_email,
                (
                    a.subscription_status = 'pro' OR EXISTS (
                        SELECT 1
                        FROM organizations paid_org
                        WHERE paid_org.id = a.active_organization_id
                          AND paid_org.subscription_status = 'team'
                    )
                ) AS is_paid
            FROM question_requests qr
            LEFT JOIN accounts a ON a.id = qr.account_id
            ORDER BY qr.created_at DESC
            LIMIT ${QUESTION_REQUEST_ROW_LIMIT}
        `,
    ]);

    return toQuestionRequestSummary(
        (totalsRes[0] || {}) as Record<string, unknown>,
        byContextRes as unknown as Record<string, unknown>[],
        byPacketModeRes as unknown as Record<string, unknown>[],
        rowsRes as unknown as QuestionRequestRow[]
    );
}
