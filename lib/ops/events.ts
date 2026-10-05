/**
 * Best-effort operational observations.
 *
 * Recording must never break a seller submission, packet download or billing
 * webhook: every writer here catches its own failures and falls back to a
 * redacted structured log line. This is telemetry, not audit evidence; Admin
 * audit writes are atomic and live in lib/neon/queries/admin-writes.ts.
 *
 * Because these observations are stored in the application database, they
 * cannot detect a database outage. That needs an external probe (see
 * docs/admin-operations-runbook.md).
 */
import { getStatementExecutor, type StatementExecutor } from '@/lib/neon/statements';

export type OperationalCategory = 'email' | 'pdf' | 'billing_webhook';
export type OperationalOutcome = 'failure' | 'success';
export type OperationalSeverity = 'info' | 'warning' | 'critical';

/** The only metadata keys that are ever stored or displayed. Values are short scalars. */
const METADATA_ALLOWLIST = new Set([
    'eventType',
    'errorName',
    'reasonCode',
    'httpStatus',
    'attachmentStatus',
    'recipientCount',
    'failedCount',
    'deliveryStatus',
    'operationId',
    'bounceType',
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Drops unknown keys and anything that is not a short scalar. */
export function sanitizeOperationalMetadata(metadata: Record<string, unknown> | undefined): Record<string, string | number | boolean> {
    const safe: Record<string, string | number | boolean> = {};
    if (!metadata) return safe;
    for (const [key, value] of Object.entries(metadata)) {
        if (!METADATA_ALLOWLIST.has(key)) continue;
        if (typeof value === 'number' && Number.isFinite(value)) safe[key] = value;
        else if (typeof value === 'boolean') safe[key] = value;
        else if (typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(value)) safe[key] = value;
    }
    return safe;
}

/** A coarse, safe error label. Raw exception messages are never stored. */
export function errorNameOf(error: unknown): string {
    const name = error instanceof Error ? error.name : typeof error;
    return /^[A-Za-z0-9_]{1,60}$/.test(name) ? name : 'Error';
}

export type OperationalEventInput = {
    category: OperationalCategory;
    code: string;
    outcome: OperationalOutcome;
    severity?: OperationalSeverity;
    fingerprint?: string;
    requestId?: string | null;
    accountId?: string | null;
    providerEventId?: string | null;
    correlationId?: string | null;
    metadata?: Record<string, unknown>;
    db?: StatementExecutor;
};

function logFallback(input: OperationalEventInput, error: unknown) {
    console.warn(JSON.stringify({
        level: 'warn',
        message: 'operational_event_not_recorded',
        category: input.category,
        code: input.code,
        outcome: input.outcome,
        recordErrorName: errorNameOf(error),
        recordErrorCode: (error as { code?: unknown } | null)?.code ?? null,
    }));
}

/**
 * Records one observation. A provider redelivery of the same event (same
 * category, provider event ID and outcome) updates the existing row, so
 * duplicate callbacks cannot inflate incident counts.
 */
export async function recordOperationalEvent(input: OperationalEventInput): Promise<boolean> {
    try {
        const db = input.db ?? getStatementExecutor();
        await db.run({
            text: `
                INSERT INTO operational_events (
                    category, code, outcome, severity, fingerprint, request_id, account_id,
                    provider_event_id, correlation_id, metadata
                )
                VALUES ($1, $2, $3, $4, $5, $6::uuid, $7::uuid, $8, $9, $10::jsonb)
                ON CONFLICT (category, provider_event_id, outcome) WHERE provider_event_id IS NOT NULL
                DO UPDATE SET attempts = operational_events.attempts + 1, last_seen_at = NOW()
            `,
            params: [
                input.category,
                input.code.slice(0, 80),
                input.outcome,
                input.severity ?? (input.outcome === 'failure' ? 'warning' : 'info'),
                (input.fingerprint ?? `${input.category}:${input.code}`).slice(0, 160),
                input.requestId && UUID.test(input.requestId) ? input.requestId : null,
                input.accountId && UUID.test(input.accountId) ? input.accountId : null,
                input.providerEventId ? input.providerEventId.slice(0, 200) : null,
                input.correlationId ? input.correlationId.slice(0, 200) : null,
                JSON.stringify(sanitizeOperationalMetadata(input.metadata)),
            ],
        });
        return true;
    } catch (error) {
        logFallback(input, error);
        return false;
    }
}

/** How often routine success is sampled as "last successful observation". */
export const SUCCESS_SAMPLE_SECONDS = 15 * 60;

/**
 * Records success evidence without a write on every request: a row is added
 * only when it recovers an earlier failure of the same provider event, or when
 * no success for this fingerprint was sampled recently.
 */
export async function recordOperationalSuccess(input: Omit<OperationalEventInput, 'outcome' | 'severity'>): Promise<boolean> {
    try {
        const db = input.db ?? getStatementExecutor();
        const fingerprint = (input.fingerprint ?? `${input.category}:${input.code}`).slice(0, 160);
        await db.run({
            text: `
                INSERT INTO operational_events (category, code, outcome, severity, fingerprint, request_id, provider_event_id, metadata)
                SELECT $1, $2, 'success', 'info', $3, $4::uuid, $5, $6::jsonb
                WHERE (
                    $5::text IS NOT NULL AND EXISTS (
                        SELECT 1 FROM operational_events
                        WHERE category = $1 AND provider_event_id = $5 AND outcome = 'failure'
                    )
                ) OR NOT EXISTS (
                    SELECT 1 FROM operational_events
                    WHERE fingerprint = $3 AND outcome = 'success'
                      AND occurred_at > NOW() - make_interval(secs => $7::double precision)
                )
                ON CONFLICT (category, provider_event_id, outcome) WHERE provider_event_id IS NOT NULL
                DO UPDATE SET last_seen_at = NOW()
            `,
            params: [
                input.category,
                input.code.slice(0, 80),
                fingerprint,
                input.requestId && UUID.test(input.requestId) ? input.requestId : null,
                input.providerEventId ? input.providerEventId.slice(0, 200) : null,
                JSON.stringify(sanitizeOperationalMetadata(input.metadata)),
                SUCCESS_SAMPLE_SECONDS,
            ],
        });
        return true;
    } catch (error) {
        logFallback({ ...input, outcome: 'success' }, error);
        return false;
    }
}

// ---------------------------------------------------------------------------
// Scheduled job runs
// ---------------------------------------------------------------------------

/** Jobs with a schedule in vercel.json. Anything else is never reported overdue. */
export const SCHEDULED_JOBS = ['activation_reconcile', 'activation_reengagement', 'account_closure_retry'] as const;
export type ScheduledJobName = (typeof SCHEDULED_JOBS)[number];
export type JobName = ScheduledJobName | 'ops_monitor';
export type JobRunHandle = { id: string | null; jobName: JobName; startedAtMs: number };

function countsOnly(summary: Record<string, unknown>): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [key, value] of Object.entries(summary)) {
        if (typeof value === 'number' && Number.isFinite(value) && /^[A-Za-z]{1,40}$/.test(key)) counts[key] = value;
    }
    return counts;
}

export async function startJobRun(jobName: JobName, db?: StatementExecutor): Promise<JobRunHandle> {
    const handle: JobRunHandle = { id: null, jobName, startedAtMs: Date.now() };
    try {
        const rows = await (db ?? getStatementExecutor()).run({
            text: `INSERT INTO job_runs (job_name) VALUES ($1) RETURNING id`,
            params: [jobName],
        });
        handle.id = rows[0] ? String(rows[0].id) : null;
    } catch (error) {
        console.warn(JSON.stringify({
            level: 'warn', message: 'job_run_start_not_recorded', jobName, recordErrorName: errorNameOf(error),
        }));
    }
    return handle;
}

export async function finishJobRun(
    handle: JobRunHandle,
    status: 'success' | 'partial' | 'failed',
    summary: Record<string, unknown> = {},
    db?: StatementExecutor
): Promise<void> {
    if (!handle.id) return;
    try {
        await (db ?? getStatementExecutor()).run({
            text: `
                UPDATE job_runs
                SET status = $2, finished_at = NOW(), duration_ms = $3, summary = $4::jsonb
                WHERE id = $1::uuid
            `,
            params: [handle.id, status, Math.max(0, Date.now() - handle.startedAtMs), JSON.stringify(countsOnly(summary))],
        });
    } catch (error) {
        console.warn(JSON.stringify({
            level: 'warn', message: 'job_run_finish_not_recorded', jobName: handle.jobName, status,
            recordErrorName: errorNameOf(error),
        }));
    }
}

// ---------------------------------------------------------------------------
// Retention
// ---------------------------------------------------------------------------

export const DEFAULT_OPS_RETENTION_DAYS = 90;

export function getOpsRetentionDays(value = process.env.OPS_EVENT_RETENTION_DAYS): number {
    const parsed = Number.parseInt(value || '', 10);
    if (!Number.isFinite(parsed)) return DEFAULT_OPS_RETENTION_DAYS;
    return Math.min(365, Math.max(7, parsed));
}

/**
 * Deletes transient observations older than the retention window. Audit logs
 * and reminder operations are deliberately out of scope.
 */
export async function pruneOperationalObservations(input: { retentionDays: number; db?: StatementExecutor }): Promise<{
    events: number;
    jobRuns: number;
}> {
    const db = input.db ?? getStatementExecutor();
    const days = Math.min(365, Math.max(7, Math.trunc(input.retentionDays)));
    const [events, jobRuns] = await db.transaction([
        {
            text: `DELETE FROM operational_events WHERE occurred_at < NOW() - make_interval(days => $1::int) RETURNING id`,
            params: [days],
        },
        {
            text: `DELETE FROM job_runs WHERE started_at < NOW() - make_interval(days => $1::int) RETURNING id`,
            params: [days],
        },
    ]);
    return { events: events.length, jobRuns: jobRuns.length };
}
