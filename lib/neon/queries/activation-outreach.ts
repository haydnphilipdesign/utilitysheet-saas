import { sql } from '@/lib/neon/db';
import type { ActivationOutreachLog, ActivationOutreachStage, ActivationOutreachStatus } from '@/types';

export type ActivationOutreachCandidate = {
    account_id: string;
    active_organization_id?: string | null;
    auth_user_id: string | null;
    email: string;
    full_name: string | null;
    test_drive_completed: boolean;
    created_at: string;
    stage: ActivationOutreachStage;
};

/**
 * New accounts (created in the last 7 days, still open) with no real request
 * yet. The window keeps older inactive accounts from being emailed. A failed
 * send waits 6 hours before the next attempt for the same stage, since the
 * cron runs every 15 minutes.
 */
export async function getDueActivationOutreachCandidates(limit = 50): Promise<ActivationOutreachCandidate[]> {
    if (!sql) return [];

    const result = await sql`
        WITH request_counts AS (
            SELECT account_id, COUNT(*)::int AS request_count
            FROM requests
            WHERE deleted_at IS NULL
              AND COALESCE(is_demo, FALSE) = FALSE
            GROUP BY account_id
        ),
        base AS (
            SELECT
                a.id AS account_id,
                a.auth_user_id,
                a.active_organization_id,
                a.email,
                a.full_name,
                a.created_at,
                COALESCE(rc.request_count, 0) AS request_count,
                EXISTS (
                    SELECT 1
                    FROM requests demo
                    WHERE demo.account_id = a.id
                      AND COALESCE(demo.is_demo, FALSE) = TRUE
                      AND demo.status = 'submitted'
                      AND demo.deleted_at IS NULL
                ) AS test_drive_completed
            FROM accounts a
            LEFT JOIN request_counts rc ON rc.account_id = a.id
            WHERE a.role = 'user'
              AND a.closure_status = 'active'
              AND COALESCE(a.email, '') <> ''
              AND a.created_at >= NOW() - INTERVAL '7 days'
              AND COALESCE(rc.request_count, 0) = 0
        )
        SELECT *
        FROM (
            SELECT
                base.account_id,
                base.auth_user_id,
                base.active_organization_id,
                base.email,
                base.full_name,
                base.created_at,
                base.test_drive_completed,
                CASE
                    WHEN base.created_at <= NOW() - INTERVAL '1 day'
                        AND NOT EXISTS (
                            SELECT 1
                            FROM activation_outreach_logs log
                            WHERE log.account_id = base.account_id
                              AND log.campaign = 'activation_reengagement'
                              AND log.stage = 'after_1d'
                              AND log.status = 'sent'
                        )
                        THEN 'after_1d'
                    WHEN base.created_at <= NOW() - INTERVAL '15 minutes'
                        AND NOT EXISTS (
                            SELECT 1
                            FROM activation_outreach_logs log
                            WHERE log.account_id = base.account_id
                              AND log.campaign = 'activation_reengagement'
                              AND log.stage IN ('after_15m', 'after_1d')
                              AND log.status = 'sent'
                        )
                        THEN 'after_15m'
                    ELSE NULL
                END AS stage
            FROM base
        ) candidates
        WHERE stage IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM activation_outreach_logs failed
              WHERE failed.account_id = candidates.account_id
                AND failed.campaign = 'activation_reengagement'
                AND failed.stage = candidates.stage
                AND failed.status = 'failed'
                AND COALESCE((failed.metadata->>'attempted_at')::timestamptz, failed.created_at) > NOW() - INTERVAL '6 hours'
          )
        ORDER BY created_at ASC
        LIMIT ${Math.max(1, Math.min(limit, 200))}
    `;

    return result as ActivationOutreachCandidate[];
}

export async function recordActivationOutreachAttempt(input: {
    accountId: string;
    authUserId?: string | null;
    email: string;
    stage: ActivationOutreachStage;
    status: ActivationOutreachStatus;
    metadata?: Record<string, unknown>;
    sentAt?: Date | null;
}) {
    if (!sql) return null;

    const result = await sql`
        INSERT INTO activation_outreach_logs (
            account_id,
            auth_user_id,
            email,
            campaign,
            stage,
            status,
            metadata,
            sent_at
        )
        VALUES (
            ${input.accountId},
            ${input.authUserId || null},
            ${input.email},
            'activation_reengagement',
            ${input.stage},
            ${input.status},
            ${JSON.stringify(input.metadata || {})}::jsonb,
            ${input.status === 'sent' ? (input.sentAt || new Date()).toISOString() : null}
        )
        ON CONFLICT (account_id, campaign, stage)
        DO UPDATE SET
            auth_user_id = EXCLUDED.auth_user_id,
            email = EXCLUDED.email,
            status = EXCLUDED.status,
            metadata = EXCLUDED.metadata,
            sent_at = CASE
                WHEN EXCLUDED.status = 'sent' THEN COALESCE(activation_outreach_logs.sent_at, EXCLUDED.sent_at)
                ELSE activation_outreach_logs.sent_at
            END
        RETURNING *
    `;

    return (result[0] as ActivationOutreachLog) || null;
}
