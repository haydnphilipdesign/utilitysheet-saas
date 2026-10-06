/**
 * Durable seller reminder operations: the shared claim, cooldown and outcome
 * record used by both the Admin action and the customer reminder endpoint.
 *
 * See `.ai/decisions/2026-10-05-seller-reminder-operations.md`.
 */
import { getStatementExecutor, type SqlStatement, type StatementExecutor } from '@/lib/neon/statements';
import type { AdminActor } from '@/lib/neon/queries/admin-writes';

/** Existing customer cooldown, now shared by every reminder path. */
export const REMINDER_COOLDOWN_SECONDS = 10 * 60;
/** A pending claim this old was abandoned mid-send; its outcome is unknown. */
export const REMINDER_ABANDONED_CLAIM_SECONDS = 15 * 60;
/** A resubmission this soon after the last attempt is a double click, not a retry. */
export const REMINDER_IN_FLIGHT_SECONDS = 60;
/**
 * Resend keeps idempotency keys for 24 hours. Retrying the same operation is
 * only safe inside that window, so the retry window stops an hour short of it.
 */
export const REMINDER_RETRY_WINDOW_SECONDS = 23 * 60 * 60;
/** An unknown outcome blocks fresh sends for as long as the provider could still deduplicate it. */
export const REMINDER_UNKNOWN_BLOCK_SECONDS = 24 * 60 * 60;

export type ReminderActor =
    | { type: 'admin'; admin: AdminActor; reason: string }
    | { type: 'agent'; accountId: string; ipAddress: string | null; userAgent: string | null };

export type ReminderClaimOutcome =
    | 'CLAIMED'
    | 'RESUMED'
    | 'ALREADY_ACCEPTED'
    | 'OPERATION_FAILED'
    | 'OPERATION_MISMATCH'
    | 'NOT_FOUND'
    | 'ACTOR_NOT_ADMIN'
    | 'REQUEST_DELETED'
    | 'REQUEST_SUBMITTED'
    | 'OWNER_INELIGIBLE'
    | 'RECIPIENT_CHANGED'
    | 'PAYLOAD_CHANGED'
    | 'RETRY_WINDOW_EXPIRED'
    | 'IN_FLIGHT'
    | 'UNRESOLVED'
    | 'COOLDOWN';

export type ReminderClaim = {
    outcome: ReminderClaimOutcome;
    /** The operation blocking a fresh send, when there is one. */
    blockingOperationId: string | null;
    retryAfterSeconds: number | null;
};

type Db = { db?: StatementExecutor };
const executor = (input: Db) => input.db ?? getStatementExecutor();

function actorAccountId(actor: ReminderActor) {
    return actor.type === 'admin' ? actor.admin.adminId : actor.accountId;
}

function actorContext(actor: ReminderActor) {
    return actor.type === 'admin'
        ? { ipAddress: actor.admin.ipAddress, userAgent: actor.admin.userAgent }
        : { ipAddress: actor.ipAddress, userAgent: actor.userAgent };
}

function adminAuditMetadata(actor: ReminderActor): string | null {
    if (actor.type !== 'admin') return null;
    return JSON.stringify({
        reason: actor.reason,
        ...(actor.admin.userAgent ? { userAgent: actor.admin.userAgent } : {}),
    });
}

/**
 * The three statements run as one transaction. The advisory lock serializes
 * every reminder path for the request; in READ COMMITTED the statements after
 * it see whatever the previous holder committed, so two simultaneous callers
 * (two Admin sessions, or Admin and customer) cannot both claim. The partial
 * unique index on pending rows is the database-level backstop.
 */
export function reminderClaimStatements(input: {
    operationId: string;
    requestId: string;
    actor: ReminderActor;
    recipientEmail: string;
    payloadFingerprint: string;
}): SqlStatement[] {
    const isAdmin = input.actor.type === 'admin';
    return [
        {
            text: `SELECT pg_advisory_xact_lock(hashtextextended('utilitysheet:seller-reminder:' || $1::text, 0))`,
            params: [input.requestId],
        },
        {
            // A claim that never recorded an outcome was interrupted mid-send.
            text: `
                UPDATE reminder_operations
                SET state = 'unknown', failure_code = 'abandoned_claim', updated_at = NOW()
                WHERE request_id = $1::uuid
                  AND state = 'pending'
                  AND updated_at < NOW() - make_interval(secs => $2::double precision)
            `,
            params: [input.requestId, REMINDER_ABANDONED_CLAIM_SECONDS],
        },
        {
            text: `
                WITH req AS (
                    SELECT r.id, r.account_id, r.status, r.metered_at, r.seller_edit_version, r.deleted_at, r.seller_email, r.property_address,
                        a.role AS owner_role, a.closure_status AS owner_closure_status
                    FROM requests r
                    JOIN accounts a ON a.id = r.account_id
                    WHERE r.id = $2::uuid
                    FOR UPDATE OF r
                ),
                existing AS (
                    SELECT * FROM reminder_operations WHERE id = $1::uuid
                ),
                blocker AS (
                    SELECT o.id, o.state
                    FROM reminder_operations o
                    WHERE o.request_id = $2::uuid
                      AND o.purpose = 'seller_reminder'
                      AND o.id <> $1::uuid
                      AND (
                          o.state = 'pending'
                          OR (o.state = 'unknown' AND o.created_at > NOW() - make_interval(secs => $13::double precision))
                      )
                    ORDER BY (o.state = 'pending') DESC, o.created_at DESC
                    LIMIT 1
                ),
                last_sent AS (
                    SELECT MAX(created_at) AS at
                    FROM event_logs
                    WHERE request_id = $2::uuid AND event_type = 'reminder_sent'
                ),
                decision AS (
                    SELECT q.id, q.account_id, q.property_address,
                        (SELECT id FROM blocker) AS blocker_id,
                        CASE
                            WHEN $8::boolean AND NOT EXISTS (SELECT 1 FROM accounts WHERE id = $4::uuid AND role = 'admin') THEN 'ACTOR_NOT_ADMIN'
                            WHEN EXISTS (SELECT 1 FROM existing e WHERE e.request_id <> q.id) THEN 'OPERATION_MISMATCH'
                            WHEN EXISTS (SELECT 1 FROM existing e WHERE e.state = 'accepted') THEN 'ALREADY_ACCEPTED'
                            WHEN EXISTS (SELECT 1 FROM existing e WHERE e.state = 'failed') THEN 'OPERATION_FAILED'
                            WHEN q.deleted_at IS NOT NULL THEN 'REQUEST_DELETED'
                            WHEN $8::boolean AND (q.status = 'submitted' OR (q.metered_at IS NOT NULL
                                AND NOT (q.status = 'in_progress' AND q.seller_edit_version > 0))) THEN 'REQUEST_SUBMITTED'
                            WHEN $8::boolean AND (q.owner_role = 'banned' OR q.owner_closure_status <> 'active') THEN 'OWNER_INELIGIBLE'
                            WHEN NULLIF(btrim(q.seller_email), '') IS DISTINCT FROM $6::text THEN 'RECIPIENT_CHANGED'
                            WHEN EXISTS (SELECT 1 FROM existing e WHERE e.payload_fingerprint <> $7::text) THEN 'PAYLOAD_CHANGED'
                            WHEN EXISTS (SELECT 1 FROM existing e
                                WHERE e.created_at <= NOW() - make_interval(secs => $12::double precision)) THEN 'RETRY_WINDOW_EXPIRED'
                            WHEN EXISTS (SELECT 1 FROM existing e
                                WHERE e.state = 'pending'
                                  AND e.updated_at > NOW() - make_interval(secs => $14::double precision)) THEN 'IN_FLIGHT'
                            WHEN EXISTS (SELECT 1 FROM existing) THEN 'RESUMED'
                            WHEN EXISTS (SELECT 1 FROM blocker b WHERE b.state = 'pending') THEN 'IN_FLIGHT'
                            WHEN EXISTS (SELECT 1 FROM blocker) THEN 'UNRESOLVED'
                            WHEN (SELECT at FROM last_sent) > NOW() - make_interval(secs => $9::double precision) THEN 'COOLDOWN'
                            ELSE 'CLAIMED'
                        END AS outcome
                    FROM req q
                ),
                inserted AS (
                    INSERT INTO reminder_operations (
                        id, request_id, actor_type, actor_account_id, reason, recipient_email, payload_fingerprint, state, attempt_count
                    )
                    SELECT $1::uuid, $2::uuid, $3::text, $4::uuid, $5::text, $6::text, $7::text, 'pending', 1
                    FROM decision d WHERE d.outcome = 'CLAIMED'
                    RETURNING id
                ),
                resumed AS (
                    UPDATE reminder_operations o
                    SET state = 'pending', attempt_count = o.attempt_count + 1, updated_at = NOW()
                    FROM decision d
                    WHERE o.id = $1::uuid AND d.outcome = 'RESUMED'
                    RETURNING o.id
                ),
                audit AS (
                    -- The attempt is on record before the provider is contacted.
                    INSERT INTO admin_audit_logs (admin_id, target_user_id, action, metadata, ip_address)
                    SELECT $4::uuid, d.account_id, 'request_reminder_attempted',
                        $10::jsonb || jsonb_build_object(
                            'requestId', d.id,
                            'operationId', $1::text,
                            'propertyAddress', d.property_address,
                            'resumed', d.outcome = 'RESUMED'
                        ),
                        $11::text
                    FROM decision d
                    WHERE d.outcome IN ('CLAIMED', 'RESUMED') AND $10::jsonb IS NOT NULL
                    RETURNING id
                )
                SELECT d.outcome,
                    CASE WHEN d.outcome IN ('IN_FLIGHT', 'UNRESOLVED') THEN COALESCE(d.blocker_id, $1::uuid) END AS blocking_operation_id,
                    CASE WHEN d.outcome = 'COOLDOWN' THEN GREATEST(1, CEIL(EXTRACT(EPOCH FROM (
                        (SELECT at FROM last_sent) + make_interval(secs => $9::double precision) - NOW()
                    )))::int) END AS retry_after_seconds,
                    (SELECT COUNT(*) FROM inserted)::int AS inserted_count,
                    (SELECT COUNT(*) FROM resumed)::int AS resumed_count,
                    (SELECT COUNT(*) FROM audit)::int AS audit_count
                FROM decision d
            `,
            params: [
                input.operationId,
                input.requestId,
                input.actor.type,
                actorAccountId(input.actor),
                input.actor.type === 'admin' ? input.actor.reason : null,
                input.recipientEmail,
                input.payloadFingerprint,
                isAdmin,
                REMINDER_COOLDOWN_SECONDS,
                adminAuditMetadata(input.actor),
                actorContext(input.actor).ipAddress,
                REMINDER_RETRY_WINDOW_SECONDS,
                REMINDER_UNKNOWN_BLOCK_SECONDS,
                REMINDER_IN_FLIGHT_SECONDS,
            ],
        },
    ];
}

export async function claimReminderOperation(
    input: Parameters<typeof reminderClaimStatements>[0] & Db
): Promise<ReminderClaim> {
    const results = await executor(input).transaction(reminderClaimStatements(input));
    const row = results[2]?.[0];
    if (!row) return { outcome: 'NOT_FOUND', blockingOperationId: null, retryAfterSeconds: null };
    return {
        outcome: row.outcome as ReminderClaimOutcome,
        blockingOperationId: row.blocking_operation_id ? String(row.blocking_operation_id) : null,
        retryAfterSeconds: row.retry_after_seconds === null || row.retry_after_seconds === undefined
            ? null
            : Number(row.retry_after_seconds),
    };
}

/**
 * Records provider acceptance, the single `reminder_sent` timeline event and
 * (for Admin) the audit entry in one statement. Only a pending or unknown
 * operation can be finalized, so repeating this never duplicates the event.
 */
export async function finalizeReminderAccepted(input: Db & {
    operationId: string;
    providerMessageId: string | null;
    /** Admin whose action completed the operation; null for the customer path. */
    admin: AdminActor | null;
    auditAction?: 'request_reminder_sent' | 'request_reminder_resolved';
    auditReason?: string | null;
    verifiedManually?: boolean;
    ipAddress: string | null;
    userAgent: string | null;
}): Promise<{ finalized: boolean }> {
    const rows = await executor(input).run({
        text: `
            WITH op AS (
                UPDATE reminder_operations
                SET state = 'accepted',
                    provider_message_id = COALESCE($2::text, provider_message_id),
                    failure_code = NULL,
                    accepted_at = NOW(), finalized_at = NOW(), updated_at = NOW()
                WHERE id = $1::uuid AND state IN ('pending', 'unknown')
                RETURNING id, request_id, actor_type, actor_account_id, reason, recipient_email, provider_message_id
            ),
            req AS (
                SELECT r.id, r.account_id, r.property_address
                FROM requests r JOIN op ON op.request_id = r.id
            ),
            timeline AS (
                INSERT INTO event_logs (request_id, event_type, event_data, ip_address, user_agent)
                SELECT op.request_id, 'reminder_sent',
                    jsonb_strip_nulls(jsonb_build_object(
                        'actor', op.actor_type,
                        'channel', 'email',
                        'operationId', op.id,
                        'adminId', CASE WHEN op.actor_type = 'admin' THEN op.actor_account_id::text END,
                        'reason', CASE WHEN op.actor_type = 'admin' THEN op.reason END,
                        'verifiedManually', CASE WHEN $5::boolean THEN TRUE END
                    )),
                    $3::text, $4::text
                FROM op
                RETURNING id
            ),
            audit AS (
                INSERT INTO admin_audit_logs (admin_id, target_user_id, action, metadata, ip_address)
                SELECT $6::uuid, req.account_id, $7::text,
                    $8::jsonb || jsonb_strip_nulls(jsonb_build_object(
                        'requestId', op.request_id,
                        'operationId', op.id,
                        'sellerEmail', op.recipient_email,
                        'propertyAddress', req.property_address,
                        'providerMessageId', op.provider_message_id,
                        'resolution', CASE WHEN $5::boolean THEN 'accepted' END
                    )),
                    $3::text
                FROM op JOIN req ON req.id = op.request_id
                WHERE $6::uuid IS NOT NULL
                RETURNING id
            )
            SELECT (SELECT COUNT(*) FROM op)::int AS finalized,
                (SELECT COUNT(*) FROM timeline)::int AS event_count,
                (SELECT COUNT(*) FROM audit)::int AS audit_count
        `,
        params: [
            input.operationId,
            input.providerMessageId,
            input.ipAddress,
            input.userAgent,
            input.verifiedManually === true,
            input.admin?.adminId ?? null,
            input.auditAction ?? 'request_reminder_sent',
            JSON.stringify({
                ...(input.auditReason ? { reason: input.auditReason } : {}),
                ...(input.admin?.userAgent ? { userAgent: input.admin.userAgent } : {}),
            }),
        ],
    });
    return { finalized: Number(rows[0]?.finalized ?? 0) === 1 };
}

/** Records a definitive rejection or an ambiguous outcome for a pending operation. */
export async function recordReminderOutcome(input: Db & {
    operationId: string;
    state: 'failed' | 'unknown';
    failureCode: string;
}): Promise<{ recorded: boolean }> {
    const rows = await executor(input).run({
        text: `
            UPDATE reminder_operations
            SET state = $2::text,
                failure_code = $3::text,
                finalized_at = CASE WHEN $2::text = 'failed' THEN NOW() ELSE NULL END,
                updated_at = NOW()
            WHERE id = $1::uuid AND state = 'pending'
            RETURNING id
        `,
        params: [input.operationId, input.state, input.failureCode.slice(0, 80)],
    });
    return { recorded: rows.length === 1 };
}

/**
 * Operator verified with the provider that an unresolved reminder was not sent.
 * The resolution and its audit entry commit together.
 */
export async function resolveReminderNotSent(input: Db & {
    operationId: string;
    admin: AdminActor;
    reason: string;
}): Promise<{ resolved: boolean }> {
    const rows = await executor(input).run({
        text: `
            WITH op AS (
                UPDATE reminder_operations o
                SET state = 'failed', failure_code = 'resolved_not_sent', finalized_at = NOW(), updated_at = NOW()
                WHERE o.id = $1::uuid
                  AND o.state IN ('pending', 'unknown')
                  AND EXISTS (SELECT 1 FROM accounts WHERE id = $2::uuid AND role = 'admin')
                RETURNING o.id, o.request_id
            ),
            audit AS (
                INSERT INTO admin_audit_logs (admin_id, target_user_id, action, metadata, ip_address)
                SELECT $2::uuid, r.account_id, 'request_reminder_resolved',
                    $3::jsonb || jsonb_build_object(
                        'requestId', op.request_id, 'operationId', op.id, 'resolution', 'failed',
                        'propertyAddress', r.property_address),
                    $4::text
                FROM op JOIN requests r ON r.id = op.request_id
                RETURNING id
            )
            SELECT (SELECT COUNT(*) FROM op)::int AS resolved, (SELECT COUNT(*) FROM audit)::int AS audit_count
        `,
        params: [
            input.operationId,
            input.admin.adminId,
            JSON.stringify({
                reason: input.reason,
                ...(input.admin.userAgent ? { userAgent: input.admin.userAgent } : {}),
            }),
            input.admin.ipAddress,
        ],
    });
    return { resolved: Number(rows[0]?.resolved ?? 0) === 1 };
}

export type ReminderOperationRow = {
    id: string;
    requestId: string;
    actorType: 'admin' | 'agent';
    state: 'pending' | 'accepted' | 'failed' | 'unknown';
    failureCode: string | null;
    providerMessageId: string | null;
    payloadFingerprint: string;
    recipientEmail: string;
    deliveryStatus: string | null;
    attemptCount: number;
    createdAt: string;
    updatedAt: string;
    acceptedAt: string | null;
};

const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : value ? String(value) : null);

function toOperation(row: Record<string, unknown>): ReminderOperationRow {
    return {
        id: String(row.id),
        requestId: String(row.request_id),
        actorType: row.actor_type as 'admin' | 'agent',
        state: row.state as ReminderOperationRow['state'],
        failureCode: (row.failure_code as string | null) ?? null,
        providerMessageId: (row.provider_message_id as string | null) ?? null,
        payloadFingerprint: String(row.payload_fingerprint),
        recipientEmail: String(row.recipient_email),
        deliveryStatus: (row.delivery_status as string | null) ?? null,
        attemptCount: Number(row.attempt_count),
        createdAt: iso(row.created_at)!,
        updatedAt: iso(row.updated_at)!,
        acceptedAt: iso(row.accepted_at),
    };
}

export async function getReminderOperation(input: Db & { operationId: string }): Promise<ReminderOperationRow | null> {
    const rows = await executor(input).run({
        text: `SELECT * FROM reminder_operations WHERE id = $1::uuid`,
        params: [input.operationId],
    });
    return rows[0] ? toOperation(rows[0]) : null;
}

/** Recent operations plus the last recorded `reminder_sent` event for the request. */
export async function getReminderHistory(input: Db & { requestId: string; limit?: number }): Promise<{
    operations: ReminderOperationRow[];
    lastSentAt: string | null;
}> {
    const db = executor(input);
    const [operations, lastSent] = await Promise.all([
        db.run({
            text: `
                SELECT * FROM reminder_operations
                WHERE request_id = $1::uuid
                ORDER BY created_at DESC, id DESC
                LIMIT $2::int
            `,
            params: [input.requestId, Math.min(20, Math.max(1, input.limit ?? 5))],
        }),
        db.run({
            text: `SELECT MAX(created_at) AS at FROM event_logs WHERE request_id = $1::uuid AND event_type = 'reminder_sent'`,
            params: [input.requestId],
        }),
    ]);
    return { operations: operations.map(toOperation), lastSentAt: iso(lastSent[0]?.at) };
}
