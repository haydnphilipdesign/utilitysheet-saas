/**
 * Read model for the Admin Operations page and alert evaluation.
 *
 * Every section distinguishes "not installed", "could not load", "no
 * observations yet", "stale" and "zero failures". A missing table or failed
 * query is never rendered as zero incidents.
 */
import { SCHEDULED_JOBS, type ScheduledJobName } from '@/lib/ops/events';
import { getStatementExecutor, isMissingRelationError, type SqlRow, type StatementExecutor } from '@/lib/neon/statements';

export type SectionState<T> =
    | { status: 'ok'; data: T }
    /** The migration that creates the backing table has not been applied. */
    | { status: 'not_installed' }
    | { status: 'error' };

async function section<T>(load: () => Promise<T>): Promise<SectionState<T>> {
    try {
        return { status: 'ok', data: await load() };
    } catch (error) {
        if (isMissingRelationError(error)) return { status: 'not_installed' };
        console.error(JSON.stringify({
            level: 'error',
            message: 'operations_section_failed',
            errorName: error instanceof Error ? error.name : typeof error,
        }));
        return { status: 'error' };
    }
}

const iso = (value: unknown): string | null => (value instanceof Date ? value.toISOString() : value ? String(value) : null);
const int = (value: unknown) => Number(value ?? 0) || 0;

export const INCIDENT_LOOKBACK_DAYS = 14;
const LIST_LIMIT = 50;

// ---------------------------------------------------------------------------
// Service incidents
// ---------------------------------------------------------------------------

export type Incident = {
    sourceKey: string;
    fingerprint: string;
    category: 'email' | 'pdf' | 'billing_webhook';
    code: string;
    severity: 'info' | 'warning' | 'critical';
    firstOccurredAt: string;
    lastOccurredAt: string;
    occurrences: number;
    /** Failures with no later success evidence. Zero means recovery was observed. */
    unrecovered: number;
    lastSuccessAt: string | null;
    latestRequestId: string | null;
};

export type IncidentSummary = {
    incidents: Incident[];
    /** Oldest and newest observation of any kind, to tell "quiet" from "not collecting". */
    firstObservationAt: string | null;
    lastObservationAt: string | null;
    truncated: boolean;
};

export async function getIncidentSummary(db: StatementExecutor, lookbackDays = INCIDENT_LOOKBACK_DAYS): Promise<IncidentSummary> {
    const [rows, bounds] = await Promise.all([
        db.run({
            text: `
                WITH failures AS (
                    SELECT e.*,
                        EXISTS (
                            SELECT 1 FROM operational_events s
                            WHERE s.outcome = 'success' AND s.category = e.category
                              AND (
                                  (e.provider_event_id IS NOT NULL AND s.provider_event_id = e.provider_event_id)
                                  OR (e.provider_event_id IS NULL AND s.fingerprint = e.fingerprint AND s.occurred_at > e.occurred_at)
                              )
                        ) AS recovered
                    FROM operational_events e
                    WHERE e.outcome = 'failure'
                      AND e.occurred_at > NOW() - make_interval(days => $1::int)
                )
                SELECT f.fingerprint, f.category, f.code,
                    MAX(CASE f.severity WHEN 'critical' THEN 3 WHEN 'warning' THEN 2 ELSE 1 END) AS severity_rank,
                    MIN(f.occurred_at) AS first_occurred_at,
                    MAX(f.occurred_at) AS last_occurred_at,
                    COUNT(*)::int AS occurrences,
                    COUNT(*) FILTER (WHERE NOT f.recovered)::int AS unrecovered,
                    (SELECT MAX(s.occurred_at) FROM operational_events s
                        WHERE s.outcome = 'success' AND s.category = f.category) AS last_success_at,
                    (ARRAY_AGG(f.request_id ORDER BY f.occurred_at DESC) FILTER (WHERE f.request_id IS NOT NULL))[1] AS latest_request_id
                FROM failures f
                GROUP BY f.fingerprint, f.category, f.code
                ORDER BY MAX(f.occurred_at) DESC, f.fingerprint ASC
                LIMIT $2::int
            `,
            params: [lookbackDays, LIST_LIMIT + 1],
        }),
        db.run({
            text: `SELECT MIN(occurred_at) AS first_at, MAX(last_seen_at) AS last_at FROM operational_events`,
            params: [],
        }),
    ]);

    return {
        incidents: rows.slice(0, LIST_LIMIT).map((row) => ({
            sourceKey: `incident:${row.fingerprint}`,
            fingerprint: String(row.fingerprint),
            category: row.category as Incident['category'],
            code: String(row.code),
            severity: int(row.severity_rank) >= 3 ? 'critical' : int(row.severity_rank) === 2 ? 'warning' : 'info',
            firstOccurredAt: iso(row.first_occurred_at)!,
            lastOccurredAt: iso(row.last_occurred_at)!,
            occurrences: int(row.occurrences),
            unrecovered: int(row.unrecovered),
            lastSuccessAt: iso(row.last_success_at),
            latestRequestId: row.latest_request_id ? String(row.latest_request_id) : null,
        })),
        firstObservationAt: iso(bounds[0]?.first_at),
        lastObservationAt: iso(bounds[0]?.last_at),
        truncated: rows.length > LIST_LIMIT,
    };
}

// ---------------------------------------------------------------------------
// Scheduled jobs
// ---------------------------------------------------------------------------

/** Daily jobs are overdue after 26 hours without a success. */
export const JOB_OVERDUE_HOURS = 26;

export type JobHealth =
    /** Never observed: monitoring has not seen this job run. Not the same as overdue. */
    | 'not_observed'
    /** Observed recently for the first time; too early to call it overdue. */
    | 'within_grace'
    | 'ok'
    | 'partial'
    | 'failed'
    | 'overdue';

export type JobStatus = {
    jobName: ScheduledJobName;
    health: JobHealth;
    lastStartedAt: string | null;
    lastStatus: 'running' | 'success' | 'partial' | 'failed' | null;
    lastDurationMs: number | null;
    lastSuccessAt: string | null;
    firstObservedAt: string | null;
};

export const JOB_LABELS: Record<ScheduledJobName, string> = {
    activation_reconcile: 'Signup reconciliation',
    activation_reengagement: 'Activation re-engagement email',
    account_closure_retry: 'Account closure retry',
};

/**
 * Pure classification so grace windows and overdue thresholds can be tested
 * with a fixed clock. A job is overdue only once monitoring has been observing
 * it for longer than the threshold; a job with no observations is never overdue.
 */
export function classifyJob(input: Omit<JobStatus, 'health'>, now: Date, overdueHours = JOB_OVERDUE_HOURS): JobHealth {
    if (!input.firstObservedAt || !input.lastStartedAt) return 'not_observed';
    const thresholdMs = overdueHours * 60 * 60 * 1000;
    const nowMs = now.getTime();
    const lastSuccessMs = input.lastSuccessAt ? Date.parse(input.lastSuccessAt) : null;
    const sinceBaseline = nowMs - (lastSuccessMs ?? Date.parse(input.firstObservedAt));

    if (sinceBaseline > thresholdMs) return 'overdue';
    if (input.lastStatus === 'failed') return 'failed';
    if (input.lastStatus === 'partial') return 'partial';
    if (lastSuccessMs === null) return 'within_grace';
    return 'ok';
}

export async function getJobStatuses(db: StatementExecutor, now = new Date()): Promise<JobStatus[]> {
    const rows = await db.run({
        text: `
            SELECT j.job_name,
                MIN(j.started_at) AS first_observed_at,
                MAX(j.finished_at) FILTER (WHERE j.status = 'success') AS last_success_at,
                (ARRAY_AGG(j.started_at ORDER BY j.started_at DESC))[1] AS last_started_at,
                (ARRAY_AGG(j.status ORDER BY j.started_at DESC))[1] AS last_status,
                (ARRAY_AGG(j.duration_ms ORDER BY j.started_at DESC))[1] AS last_duration_ms
            FROM job_runs j
            WHERE j.job_name = ANY($1::text[])
            GROUP BY j.job_name
        `,
        params: [[...SCHEDULED_JOBS]],
    });
    const byName = new Map(rows.map((row) => [String(row.job_name), row] as const));

    return SCHEDULED_JOBS.map((jobName) => {
        const row: SqlRow | undefined = byName.get(jobName);
        const base = {
            jobName,
            lastStartedAt: iso(row?.last_started_at),
            lastStatus: (row?.last_status as JobStatus['lastStatus']) ?? null,
            lastDurationMs: row?.last_duration_ms === null || row?.last_duration_ms === undefined ? null : int(row.last_duration_ms),
            lastSuccessAt: iso(row?.last_success_at),
            firstObservedAt: iso(row?.first_observed_at),
        };
        return { ...base, health: classifyJob(base, now) };
    });
}

// ---------------------------------------------------------------------------
// Seller reminder email evidence
// ---------------------------------------------------------------------------

export type ReminderEmailSummary = {
    windowDays: number;
    accepted: number;
    delivered: number;
    delayed: number;
    bounced: number;
    complained: number;
    deliveryFailed: number;
    /** Accepted by the provider with no delivery event received. */
    deliveryUnknown: number;
    notSent: number;
    unresolved: UnresolvedReminder[];
};

export type UnresolvedReminder = {
    sourceKey: string;
    operationId: string;
    requestId: string;
    state: 'pending' | 'unknown';
    createdAt: string;
    failureCode: string | null;
};

export async function getReminderEmailSummary(db: StatementExecutor, windowDays = 30): Promise<ReminderEmailSummary> {
    const [counts, unresolved] = await Promise.all([
        db.run({
            text: `
                SELECT
                    COUNT(*) FILTER (WHERE state = 'accepted')::int AS accepted,
                    COUNT(*) FILTER (WHERE state = 'accepted' AND delivery_status = 'delivered')::int AS delivered,
                    COUNT(*) FILTER (WHERE state = 'accepted' AND delivery_status = 'delayed')::int AS delayed,
                    COUNT(*) FILTER (WHERE state = 'accepted' AND delivery_status = 'bounced')::int AS bounced,
                    COUNT(*) FILTER (WHERE state = 'accepted' AND delivery_status = 'complained')::int AS complained,
                    COUNT(*) FILTER (WHERE state = 'accepted' AND delivery_status = 'failed')::int AS delivery_failed,
                    COUNT(*) FILTER (WHERE state = 'accepted' AND delivery_status IS NULL)::int AS delivery_unknown,
                    COUNT(*) FILTER (WHERE state = 'failed')::int AS not_sent
                FROM reminder_operations
                WHERE created_at > NOW() - make_interval(days => $1::int)
            `,
            params: [windowDays],
        }),
        db.run({
            text: `
                SELECT id, request_id, state, created_at, failure_code
                FROM reminder_operations
                WHERE state = 'unknown'
                   OR (state = 'pending' AND updated_at < NOW() - INTERVAL '15 minutes')
                ORDER BY created_at DESC, id ASC
                LIMIT $1::int
            `,
            params: [LIST_LIMIT],
        }),
    ]);
    const row = counts[0] ?? {};
    return {
        windowDays,
        accepted: int(row.accepted),
        delivered: int(row.delivered),
        delayed: int(row.delayed),
        bounced: int(row.bounced),
        complained: int(row.complained),
        deliveryFailed: int(row.delivery_failed),
        deliveryUnknown: int(row.delivery_unknown),
        notSent: int(row.not_sent),
        unresolved: unresolved.map((item) => ({
            sourceKey: `reminder:${item.id}`,
            operationId: String(item.id),
            requestId: String(item.request_id),
            state: item.state as 'pending' | 'unknown',
            createdAt: iso(item.created_at)!,
            failureCode: (item.failure_code as string | null) ?? null,
        })),
    };
}

// ---------------------------------------------------------------------------
// Customer follow-up candidates (not incidents)
// ---------------------------------------------------------------------------

export const FOLLOW_UP_INACTIVE_DAYS = 7;
export const FOLLOW_UP_PAGE_SIZE = 25;

export type FollowUpCandidate = {
    sourceKey: string;
    kind: 'request_inactive' | 'account_not_started';
    label: string;
    detail: string;
    href: string;
    /** When the condition last changed; a resolved item reappears only if this moves. */
    lastOccurredAt: string;
};

export type FollowUpSummary = {
    inactiveRequests: { total: number; items: FollowUpCandidate[] };
    accountsNotStarted: { total: number; items: FollowUpCandidate[] };
};

/**
 * Raw backlog counts and a bounded, stably sorted page of each list. Counts are
 * computed from source records only; triage state never changes them.
 */
export async function getFollowUpCandidates(db: StatementExecutor, page = 1): Promise<FollowUpSummary> {
    const offset = Math.max(0, Math.trunc(page) - 1) * FOLLOW_UP_PAGE_SIZE;
    const [requests, requestTotal, accounts, accountTotal] = await Promise.all([
        db.run({
            text: `
                SELECT r.id, r.property_address, r.status, COALESCE(r.last_activity_at, r.created_at) AS last_at
                FROM requests r
                JOIN accounts a ON a.id = r.account_id AND a.role = 'user'
                WHERE r.status IN ('sent', 'in_progress')
                  AND r.deleted_at IS NULL
                  AND COALESCE(r.is_demo, FALSE) = FALSE
                  AND COALESCE(r.last_activity_at, r.created_at) < NOW() - make_interval(days => $1::int)
                ORDER BY COALESCE(r.last_activity_at, r.created_at) DESC, r.id ASC
                LIMIT $2::int OFFSET $3::int
            `,
            params: [FOLLOW_UP_INACTIVE_DAYS, FOLLOW_UP_PAGE_SIZE, offset],
        }),
        db.run({
            text: `
                SELECT COUNT(*)::int AS n
                FROM requests r
                JOIN accounts a ON a.id = r.account_id AND a.role = 'user'
                WHERE r.status IN ('sent', 'in_progress')
                  AND r.deleted_at IS NULL
                  AND COALESCE(r.is_demo, FALSE) = FALSE
                  AND COALESCE(r.last_activity_at, r.created_at) < NOW() - make_interval(days => $1::int)
            `,
            params: [FOLLOW_UP_INACTIVE_DAYS],
        }),
        db.run({
            text: `
                SELECT a.id, a.email, a.created_at
                FROM accounts a
                WHERE a.role = 'user'
                  AND a.closure_status = 'active'
                  AND a.onboarding_completed_at IS NULL
                  AND a.created_at < NOW() - make_interval(days => $1::int)
                  AND NOT EXISTS (
                      SELECT 1 FROM requests r
                      WHERE r.account_id = a.id AND r.deleted_at IS NULL AND COALESCE(r.is_demo, FALSE) = FALSE
                  )
                ORDER BY a.created_at DESC, a.id ASC
                LIMIT $2::int OFFSET $3::int
            `,
            params: [FOLLOW_UP_INACTIVE_DAYS, FOLLOW_UP_PAGE_SIZE, offset],
        }),
        db.run({
            text: `
                SELECT COUNT(*)::int AS n
                FROM accounts a
                WHERE a.role = 'user'
                  AND a.closure_status = 'active'
                  AND a.onboarding_completed_at IS NULL
                  AND a.created_at < NOW() - make_interval(days => $1::int)
                  AND NOT EXISTS (
                      SELECT 1 FROM requests r
                      WHERE r.account_id = a.id AND r.deleted_at IS NULL AND COALESCE(r.is_demo, FALSE) = FALSE
                  )
            `,
            params: [FOLLOW_UP_INACTIVE_DAYS],
        }),
    ]);

    return {
        inactiveRequests: {
            total: int(requestTotal[0]?.n),
            items: requests.map((row) => ({
                sourceKey: `request_inactive:${row.id}`,
                kind: 'request_inactive' as const,
                label: String(row.property_address),
                detail: `${row.status === 'in_progress' ? 'In progress' : 'Sent'}, no seller activity recorded since`,
                href: `/admin/requests/${row.id}`,
                lastOccurredAt: iso(row.last_at)!,
            })),
        },
        accountsNotStarted: {
            total: int(accountTotal[0]?.n),
            items: accounts.map((row) => ({
                sourceKey: `account_not_started:${row.id}`,
                kind: 'account_not_started' as const,
                label: String(row.email),
                detail: 'Signed up, has not completed setup or created a request',
                href: `/admin/users/${row.id}`,
                lastOccurredAt: iso(row.created_at)!,
            })),
        },
    };
}

// ---------------------------------------------------------------------------
// Whole-page snapshot
// ---------------------------------------------------------------------------

export type OperationsSnapshot = {
    generatedAt: string;
    incidents: SectionState<IncidentSummary>;
    jobs: SectionState<JobStatus[]>;
    reminders: SectionState<ReminderEmailSummary>;
    followUp: SectionState<FollowUpSummary>;
};

export async function getOperationsSnapshot(input: { db?: StatementExecutor; now?: Date; followUpPage?: number } = {}): Promise<OperationsSnapshot> {
    const now = input.now ?? new Date();
    let db: StatementExecutor;
    try {
        db = input.db ?? getStatementExecutor();
    } catch {
        const error = { status: 'error' } as const;
        return { generatedAt: now.toISOString(), incidents: error, jobs: error, reminders: error, followUp: error };
    }

    const [incidents, jobs, reminders, followUp] = await Promise.all([
        section(() => getIncidentSummary(db)),
        section(() => getJobStatuses(db, now)),
        section(() => getReminderEmailSummary(db)),
        section(() => getFollowUpCandidates(db, input.followUpPage)),
    ]);
    return { generatedAt: now.toISOString(), incidents, jobs, reminders, followUp };
}

/** Observations older than this suggest collection has stopped, not that all is well. */
export const STALE_OBSERVATION_HOURS = 48;

export function describeCollection(summary: IncidentSummary, now: Date): 'no_observations' | 'stale' | 'current' {
    if (!summary.lastObservationAt) return 'no_observations';
    const ageMs = now.getTime() - Date.parse(summary.lastObservationAt);
    return ageMs > STALE_OBSERVATION_HOURS * 60 * 60 * 1000 ? 'stale' : 'current';
}
