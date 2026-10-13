/**
 * Storage and read model for email handoff and PDF execution evidence
 * (`notification_observations`, `pdf_render_observations`).
 *
 * Writes are auxiliary: they are bounded, never retried and never change the
 * result of the send, download or submission they describe. See
 * lib/telemetry/handoff-evidence.ts for the contract.
 */
import { getStatementExecutor, isMissingRelationError, type SqlRow, type StatementExecutor } from '@/lib/neon/statements';
import { writeAuxiliary } from '@/lib/telemetry/auxiliary-write';
import type { DeliveryStatus } from '@/lib/ops/email-delivery';
import {
    NOTIFICATION_OBSERVATION_MAX_PER_REQUEST,
    NOTIFICATION_PURPOSES,
    PDF_FAILURE_STAGES,
    PDF_OBSERVATION_MAX_PER_REQUEST,
    type HandoffEvidence,
    type NotificationPurpose,
    type PdfFailureStage,
    type PdfSurface,
} from '@/lib/telemetry/handoff-evidence';

type Db = { db?: StatementExecutor };

const iso = (value: unknown): string | null => (value instanceof Date ? value.toISOString() : value ? String(value) : null);
const int = (value: unknown) => Number(value ?? 0) || 0;
const nullableInt = (value: unknown) => (value === null || value === undefined ? null : Math.round(Number(value)));

/**
 * One statement for both tables. A repeated (operation, slot) is stored once,
 * and nothing is stored for a request that has reached its row ceiling.
 * Returns how many rows were stored.
 */
export async function insertHandoffEvidence(
    evidence: HandoffEvidence,
    options: Db & { signal?: AbortSignal } = {},
): Promise<{ notifications: number; pdfRenders: number }> {
    if (evidence.notifications.length === 0 && evidence.pdfRenders.length === 0) return { notifications: 0, pdfRenders: 0 };
    const db = options.db ?? getStatementExecutor();
    const rows = await db.run({
        text: `
            WITH n_in AS (
                SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(
                    operation_id uuid, request_id uuid, purpose text, mode text, recipient_slot int,
                    intended_recipients int, send_outcome text, provider_message_id text,
                    failure_code text, attachment_status text
                )
            ), n_ins AS (
                INSERT INTO notification_observations (
                    operation_id, request_id, purpose, mode, recipient_slot, intended_recipients,
                    send_outcome, provider_message_id, failure_code, attachment_status
                )
                SELECT i.operation_id, i.request_id, i.purpose, i.mode, i.recipient_slot, i.intended_recipients,
                    i.send_outcome, i.provider_message_id, i.failure_code, i.attachment_status
                FROM n_in i
                WHERE (SELECT COUNT(*) FROM notification_observations o WHERE o.request_id = i.request_id)
                    + (SELECT COUNT(*) FROM n_in) <= $3::int
                ON CONFLICT (operation_id, recipient_slot) DO NOTHING
                RETURNING id
            ), p_in AS (
                SELECT * FROM jsonb_to_recordset($2::jsonb) AS x(
                    request_id uuid, operation_id uuid, recipient_slot int, surface text, mode text,
                    packet_mode text, render_strategy text, launch_strategy text, outcome text,
                    skip_reason text, failure_stage text, error_name text, http_status int,
                    total_ms int, data_ms int, launch_ms int, render_ms int, bytes int
                )
            ), p_ins AS (
                INSERT INTO pdf_render_observations (
                    request_id, operation_id, recipient_slot, surface, mode, packet_mode, render_strategy,
                    launch_strategy, outcome, skip_reason, failure_stage, error_name, http_status,
                    total_ms, data_ms, launch_ms, render_ms, bytes
                )
                SELECT i.request_id, i.operation_id, i.recipient_slot, i.surface, i.mode, i.packet_mode, i.render_strategy,
                    i.launch_strategy, i.outcome, i.skip_reason, i.failure_stage, i.error_name, i.http_status,
                    i.total_ms, i.data_ms, i.launch_ms, i.render_ms, i.bytes
                FROM p_in i
                WHERE (SELECT COUNT(*) FROM pdf_render_observations o WHERE o.request_id = i.request_id)
                    + (SELECT COUNT(*) FROM p_in) <= $4::int
                RETURNING id
            )
            SELECT (SELECT COUNT(*) FROM n_ins)::int AS notifications, (SELECT COUNT(*) FROM p_ins)::int AS pdf_renders
        `,
        params: [
            JSON.stringify(evidence.notifications.map((row) => ({
                operation_id: row.operationId,
                request_id: row.requestId,
                purpose: row.purpose,
                mode: row.mode,
                recipient_slot: row.recipientSlot,
                intended_recipients: row.intendedRecipients,
                send_outcome: row.sendOutcome,
                provider_message_id: row.providerMessageId,
                failure_code: row.failureCode,
                attachment_status: row.attachmentStatus,
            }))),
            JSON.stringify(evidence.pdfRenders.map((row) => ({
                request_id: row.requestId,
                operation_id: row.operationId,
                recipient_slot: row.recipientSlot,
                surface: row.surface,
                mode: row.mode,
                packet_mode: row.packetMode,
                render_strategy: row.renderStrategy,
                launch_strategy: row.launchStrategy,
                outcome: row.outcome,
                skip_reason: row.skipReason,
                failure_stage: row.failureStage,
                error_name: row.errorName,
                http_status: row.httpStatus,
                total_ms: row.totalMs,
                data_ms: row.dataMs,
                launch_ms: row.launchMs,
                render_ms: row.renderMs,
                bytes: row.bytes,
            }))),
            NOTIFICATION_OBSERVATION_MAX_PER_REQUEST,
            PDF_OBSERVATION_MAX_PER_REQUEST,
        ],
    }, { signal: options.signal });
    return { notifications: int(rows[0]?.notifications), pdfRenders: int(rows[0]?.pdf_renders) };
}

/** Best-effort recording. Resolves false when nothing could be stored; never throws. */
export async function recordHandoffEvidence(evidence: HandoffEvidence, options: Db = {}): Promise<boolean> {
    if (evidence.notifications.length === 0 && evidence.pdfRenders.length === 0) return false;
    return writeAuxiliary('handoff_evidence', async (signal) => {
        await insertHandoffEvidence(evidence, { db: options.db, signal });
        return true;
    }, false);
}

const DELIVERY_INCIDENT_SUFFIX: Partial<Record<DeliveryStatus, string>> = {
    failed: 'undelivered',
    bounced: 'bounced',
    complained: 'complained',
};

/**
 * Applies one verified provider event to completion and invitation evidence.
 * Reminders keep their own contract in lib/ops/email-delivery.ts and are
 * matched first; this is only asked about messages they did not claim.
 *
 * - The summary status only moves to a more significant fact
 *   (delayed < delivered < failed < bounced < complained), so a late or
 *   out-of-order "delivered" cannot erase a bounce or complaint.
 * - A bounce, complaint or failed delivery of a live message becomes one
 *   incident per provider event, so redeliveries do not inflate counts.
 * - An event for an unknown message stores nothing.
 */
export async function applyNotificationDeliveryEvent(input: Db & {
    providerMessageId: string;
    status: DeliveryStatus;
    webhookMessageId: string;
}): Promise<{ matched: boolean }> {
    const db = input.db ?? getStatementExecutor();
    const incidentSuffix = DELIVERY_INCIDENT_SUFFIX[input.status] ?? null;
    const rows = await db.run({
        text: `
            WITH matched AS (
                SELECT id, request_id, operation_id, mode,
                    CASE purpose WHEN 'completion_notification' THEN 'completion' ELSE 'invitation' END AS prefix
                FROM notification_observations
                WHERE provider_message_id = $1
                ORDER BY created_at ASC, id ASC
                LIMIT 1
            ),
            ranks(status, rank) AS (
                VALUES ('delayed', 1), ('delivered', 2), ('failed', 3), ('bounced', 4), ('complained', 5)
            ),
            updated AS (
                UPDATE notification_observations o
                SET delivery_status = $2, delivery_updated_at = NOW()
                FROM matched m
                WHERE o.id = m.id
                  AND COALESCE((SELECT rank FROM ranks WHERE status = o.delivery_status), 0)
                      < (SELECT rank FROM ranks WHERE status = $2)
                RETURNING o.id
            ),
            recorded AS (
                INSERT INTO operational_events (
                    category, code, outcome, severity, fingerprint, request_id, provider_event_id, metadata
                )
                SELECT 'email', m.prefix || '_' || $4::text, 'failure', $5, 'email:' || m.prefix || '_' || $4::text, m.request_id, $3,
                    jsonb_build_object('deliveryStatus', $2::text, 'operationId', m.operation_id::text)
                FROM matched m
                WHERE $4::text IS NOT NULL AND m.mode = 'live'
                ON CONFLICT (category, provider_event_id, outcome) WHERE provider_event_id IS NOT NULL
                DO UPDATE SET attempts = operational_events.attempts + 1, last_seen_at = NOW()
                RETURNING id
            )
            SELECT (SELECT COUNT(*) FROM matched)::int AS matched
        `,
        params: [
            input.providerMessageId,
            input.status,
            input.webhookMessageId.slice(0, 200),
            incidentSuffix,
            input.status === 'complained' ? 'critical' : 'warning',
        ],
    });
    return { matched: int(rows[0]?.matched) > 0 };
}

// ---------------------------------------------------------------------------
// Admin read model
// ---------------------------------------------------------------------------

export type NotificationPurposeSummary = {
    /** Handoff attempts, including ones with nobody eligible. */
    operations: number;
    noRecipients: number;
    /** Attempts where some recipients were accepted and others were not. */
    partialOperations: number;
    /** Recipient slots attempted across all operations. */
    attempted: number;
    accepted: number;
    failed: number;
    unknown: number;
    delivered: number;
    delayed: number;
    bounced: number;
    complained: number;
    deliveryFailed: number;
    /** Accepted by the provider with no delivery event received. */
    deliveryUnknown: number;
    attachmentAttached: number;
    attachmentFailed: number;
    attachmentSkipped: number;
};

export type PdfSurfaceSummary = {
    rendered: number;
    failed: number;
    /** Expected outcomes: locked or not yet submitted. */
    skipped: number;
    failedByStage: Record<PdfFailureStage, number>;
    /** Whole-operation duration of successful renders. Null with none recorded. */
    medianMs: number | null;
    p95Ms: number | null;
    medianBytes: number | null;
};

export type HandoffEvidenceSummary = {
    windowDays: number;
    /** Live handoffs only; seller test runs are counted here and nowhere else. */
    testOperations: number;
    notifications: Record<NotificationPurpose, NotificationPurposeSummary>;
    pdf: Record<PdfSurface, PdfSurfaceSummary>;
    /** Oldest and newest evidence of either kind, to tell "quiet" from "not collecting". */
    firstObservationAt: string | null;
    lastObservationAt: string | null;
};

const emptyPurpose = (): NotificationPurposeSummary => ({
    operations: 0, noRecipients: 0, partialOperations: 0, attempted: 0, accepted: 0, failed: 0, unknown: 0,
    delivered: 0, delayed: 0, bounced: 0, complained: 0, deliveryFailed: 0, deliveryUnknown: 0,
    attachmentAttached: 0, attachmentFailed: 0, attachmentSkipped: 0,
});

const emptySurface = (): PdfSurfaceSummary => ({
    rendered: 0, failed: 0, skipped: 0,
    failedByStage: Object.fromEntries(PDF_FAILURE_STAGES.map((stage) => [stage, 0])) as Record<PdfFailureStage, number>,
    medianMs: null, p95Ms: null, medianBytes: null,
});

export async function getHandoffEvidenceSummary(db: StatementExecutor, windowDays = 30): Promise<HandoffEvidenceSummary> {
    const [notificationRows, pdfRows, stageRows, bounds] = await Promise.all([
        db.run({
            text: `
                WITH scoped AS (
                    SELECT * FROM notification_observations
                    WHERE created_at > NOW() - make_interval(days => $1::int)
                ), per_operation AS (
                    SELECT operation_id, purpose, mode,
                        BOOL_OR(send_outcome = 'no_recipients') AS no_recipients,
                        COUNT(*) FILTER (WHERE send_outcome = 'accepted') AS accepted,
                        COUNT(*) FILTER (WHERE send_outcome IN ('failed', 'unknown')) AS not_accepted
                    FROM scoped GROUP BY operation_id, purpose, mode
                ), operations AS (
                    SELECT purpose,
                        COUNT(*) FILTER (WHERE mode = 'live')::int AS operations,
                        COUNT(*) FILTER (WHERE mode = 'live' AND no_recipients)::int AS no_recipients,
                        COUNT(*) FILTER (WHERE mode = 'live' AND accepted > 0 AND not_accepted > 0)::int AS partial_operations,
                        COUNT(*) FILTER (WHERE mode = 'test')::int AS test_operations
                    FROM per_operation GROUP BY purpose
                ), slots AS (
                    SELECT purpose,
                        COUNT(*) FILTER (WHERE send_outcome <> 'no_recipients')::int AS attempted,
                        COUNT(*) FILTER (WHERE send_outcome = 'accepted')::int AS accepted,
                        COUNT(*) FILTER (WHERE send_outcome = 'failed')::int AS failed,
                        COUNT(*) FILTER (WHERE send_outcome = 'unknown')::int AS unknown,
                        COUNT(*) FILTER (WHERE send_outcome = 'accepted' AND delivery_status = 'delivered')::int AS delivered,
                        COUNT(*) FILTER (WHERE send_outcome = 'accepted' AND delivery_status = 'delayed')::int AS delayed,
                        COUNT(*) FILTER (WHERE send_outcome = 'accepted' AND delivery_status = 'bounced')::int AS bounced,
                        COUNT(*) FILTER (WHERE send_outcome = 'accepted' AND delivery_status = 'complained')::int AS complained,
                        COUNT(*) FILTER (WHERE send_outcome = 'accepted' AND delivery_status = 'failed')::int AS delivery_failed,
                        COUNT(*) FILTER (WHERE send_outcome = 'accepted' AND delivery_status IS NULL)::int AS delivery_unknown,
                        COUNT(*) FILTER (WHERE attachment_status = 'attached')::int AS attachment_attached,
                        COUNT(*) FILTER (WHERE attachment_status = 'failed')::int AS attachment_failed,
                        COUNT(*) FILTER (WHERE attachment_status = 'skipped')::int AS attachment_skipped
                    FROM scoped WHERE mode = 'live' GROUP BY purpose
                )
                SELECT o.purpose, o.operations, o.no_recipients, o.partial_operations, o.test_operations,
                    s.attempted, s.accepted, s.failed, s.unknown, s.delivered, s.delayed, s.bounced, s.complained,
                    s.delivery_failed, s.delivery_unknown, s.attachment_attached, s.attachment_failed, s.attachment_skipped
                FROM operations o LEFT JOIN slots s ON s.purpose = o.purpose
            `,
            params: [windowDays],
        }),
        db.run({
            text: `
                SELECT surface,
                    COUNT(*) FILTER (WHERE outcome = 'rendered')::int AS rendered,
                    COUNT(*) FILTER (WHERE outcome = 'failed')::int AS failed,
                    COUNT(*) FILTER (WHERE outcome = 'skipped')::int AS skipped,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_ms) FILTER (WHERE outcome = 'rendered') AS median_ms,
                    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_ms) FILTER (WHERE outcome = 'rendered') AS p95_ms,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY bytes) FILTER (WHERE outcome = 'rendered') AS median_bytes
                FROM pdf_render_observations
                WHERE mode = 'live' AND created_at > NOW() - make_interval(days => $1::int)
                GROUP BY surface
            `,
            params: [windowDays],
        }),
        db.run({
            text: `
                SELECT surface, failure_stage, COUNT(*)::int AS failures
                FROM pdf_render_observations
                WHERE mode = 'live' AND outcome = 'failed' AND failure_stage IS NOT NULL
                  AND created_at > NOW() - make_interval(days => $1::int)
                GROUP BY surface, failure_stage
            `,
            params: [windowDays],
        }),
        db.run({
            text: `
                SELECT LEAST((SELECT MIN(created_at) FROM notification_observations),
                             (SELECT MIN(created_at) FROM pdf_render_observations)) AS first_at,
                       GREATEST((SELECT MAX(created_at) FROM notification_observations),
                                (SELECT MAX(created_at) FROM pdf_render_observations)) AS last_at
            `,
            params: [],
        }),
    ]);

    const notifications = Object.fromEntries(NOTIFICATION_PURPOSES.map((purpose) => [purpose, emptyPurpose()])) as HandoffEvidenceSummary['notifications'];
    let testOperations = 0;
    for (const row of notificationRows) {
        testOperations += int(row.test_operations);
        const target = notifications[row.purpose as NotificationPurpose];
        if (!target) continue;
        Object.assign(target, {
            operations: int(row.operations), noRecipients: int(row.no_recipients), partialOperations: int(row.partial_operations),
            attempted: int(row.attempted), accepted: int(row.accepted), failed: int(row.failed), unknown: int(row.unknown),
            delivered: int(row.delivered), delayed: int(row.delayed), bounced: int(row.bounced), complained: int(row.complained),
            deliveryFailed: int(row.delivery_failed), deliveryUnknown: int(row.delivery_unknown),
            attachmentAttached: int(row.attachment_attached), attachmentFailed: int(row.attachment_failed),
            attachmentSkipped: int(row.attachment_skipped),
        } satisfies NotificationPurposeSummary);
    }

    const pdf: HandoffEvidenceSummary['pdf'] = { download: emptySurface(), completion_attachment: emptySurface() };
    for (const row of pdfRows) {
        const target = pdf[row.surface as PdfSurface];
        if (!target) continue;
        target.rendered = int(row.rendered);
        target.failed = int(row.failed);
        target.skipped = int(row.skipped);
        target.medianMs = nullableInt(row.median_ms);
        target.p95Ms = nullableInt(row.p95_ms);
        target.medianBytes = nullableInt(row.median_bytes);
    }
    for (const row of stageRows) {
        const target = pdf[row.surface as PdfSurface];
        const stage = row.failure_stage as PdfFailureStage;
        if (target && stage in target.failedByStage) target.failedByStage[stage] = int(row.failures);
    }

    return {
        windowDays,
        testOperations,
        notifications,
        pdf,
        firstObservationAt: iso(bounds[0]?.first_at),
        lastObservationAt: iso(bounds[0]?.last_at),
    };
}

export type RequestNotificationEvidence = {
    operationId: string;
    purpose: NotificationPurpose;
    mode: 'live' | 'test';
    recipientSlot: number;
    intendedRecipients: number;
    sendOutcome: 'accepted' | 'failed' | 'unknown' | 'no_recipients';
    failureCode: string | null;
    attachmentStatus: string;
    deliveryStatus: DeliveryStatus | null;
    deliveryUpdatedAt: string | null;
    createdAt: string;
};

export type RequestPdfEvidence = {
    surface: PdfSurface;
    outcome: 'rendered' | 'failed' | 'skipped';
    skipReason: string | null;
    failureStage: string | null;
    packetMode: string | null;
    totalMs: number | null;
    bytes: number | null;
    createdAt: string;
};

export const REQUEST_EVIDENCE_LIMIT = 25;

/** The newest evidence for one request. Provider message IDs are not returned. */
export async function getRequestHandoffEvidence(input: Db & { requestId: string }): Promise<{
    notifications: RequestNotificationEvidence[];
    pdfRenders: RequestPdfEvidence[];
}> {
    const db = input.db ?? getStatementExecutor();
    const [notifications, pdfRenders] = await Promise.all([
        db.run({
            text: `
                SELECT operation_id, purpose, mode, recipient_slot, intended_recipients, send_outcome, failure_code,
                    attachment_status, delivery_status, delivery_updated_at, created_at
                FROM notification_observations
                WHERE request_id = $1::uuid
                ORDER BY created_at DESC, operation_id ASC, recipient_slot ASC
                LIMIT $2::int
            `,
            params: [input.requestId, REQUEST_EVIDENCE_LIMIT],
        }),
        db.run({
            text: `
                SELECT surface, outcome, skip_reason, failure_stage, packet_mode, total_ms, bytes, created_at
                FROM pdf_render_observations
                WHERE request_id = $1::uuid
                ORDER BY created_at DESC, id ASC
                LIMIT $2::int
            `,
            params: [input.requestId, REQUEST_EVIDENCE_LIMIT],
        }),
    ]);
    return {
        notifications: notifications.map((row: SqlRow) => ({
            operationId: String(row.operation_id),
            purpose: row.purpose as NotificationPurpose,
            mode: row.mode === 'test' ? 'test' : 'live',
            recipientSlot: int(row.recipient_slot),
            intendedRecipients: int(row.intended_recipients),
            sendOutcome: row.send_outcome as RequestNotificationEvidence['sendOutcome'],
            failureCode: (row.failure_code as string | null) ?? null,
            attachmentStatus: String(row.attachment_status),
            deliveryStatus: (row.delivery_status as DeliveryStatus | null) ?? null,
            deliveryUpdatedAt: iso(row.delivery_updated_at),
            createdAt: iso(row.created_at)!,
        })),
        pdfRenders: pdfRenders.map((row: SqlRow) => ({
            surface: row.surface as PdfSurface,
            outcome: row.outcome as RequestPdfEvidence['outcome'],
            skipReason: (row.skip_reason as string | null) ?? null,
            failureStage: (row.failure_stage as string | null) ?? null,
            packetMode: (row.packet_mode as string | null) ?? null,
            totalMs: nullableInt(row.total_ms),
            bytes: nullableInt(row.bytes),
            createdAt: iso(row.created_at)!,
        })),
    };
}

/** "Not installed" (migration pending) and "could not load" are never shown as zero. */
export type EvidenceState<T> = { status: 'ok'; data: T } | { status: 'not_installed' } | { status: 'error' };

async function evidenceState<T>(load: () => Promise<T>): Promise<EvidenceState<T>> {
    try {
        return { status: 'ok', data: await load() };
    } catch (error) {
        if (isMissingRelationError(error)) return { status: 'not_installed' };
        console.error(JSON.stringify({
            level: 'error',
            message: 'handoff_evidence_read_failed',
            errorName: error instanceof Error ? error.name : typeof error,
        }));
        return { status: 'error' };
    }
}

export function loadHandoffEvidenceSummary(input: Db & { windowDays?: number } = {}): Promise<EvidenceState<HandoffEvidenceSummary>> {
    return evidenceState(() => getHandoffEvidenceSummary(input.db ?? getStatementExecutor(), input.windowDays));
}

export function loadRequestHandoffEvidence(input: Db & { requestId: string }): Promise<EvidenceState<Awaited<ReturnType<typeof getRequestHandoffEvidence>>>> {
    return evidenceState(() => getRequestHandoffEvidence(input));
}