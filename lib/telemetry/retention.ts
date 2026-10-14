/**
 * Retention for telemetry and diagnostic records (telemetry Slice 9).
 *
 * Off unless configured. `TELEMETRY_RETENTION_MODE=preview` only counts what
 * each rule would affect; `enforce` deletes or scrubs in small batches, oldest
 * first. The two operational classes keep their existing switch
 * (`OPS_RETENTION_PRUNE_ENABLED`) and window (`OPS_EVENT_RETENTION_DAYS`).
 * One-time historical cleanups are previewed until
 * `TELEMETRY_RETENTION_HISTORICAL_CLEANUP=true` is also set with `enforce`.
 *
 * Every rule names its rows explicitly. Event types not listed here, reminder
 * operations, audit and security records, billing, referral credits and
 * outreach send guards are never touched. Policy:
 * .ai/decisions/2026-10-14-telemetry-retention.md.
 */
import { getStatementExecutor, isMissingRelationError, type StatementExecutor } from '@/lib/neon/statements';
import type { SectionState } from '@/lib/ops/overview';
import { finishJobRun, getOpsRetentionDays, startJobRun } from '@/lib/ops/events';
import { SELLER_OBSERVATION_EVENT_TYPES } from '@/lib/telemetry/seller-observations';

export type RetentionMode = 'off' | 'preview' | 'enforce';
export type RetentionAction = 'skip' | 'preview' | 'enforce';
type RetentionGroup = 'telemetry' | 'operations' | 'historical';

/** Rows changed per class per run. A backlog drains over several daily runs. */
export const RETENTION_BATCH_LIMIT = 2000;
/** The monitor calls retention every 15 minutes; it runs at most this often. */
export const RETENTION_MIN_INTERVAL_HOURS = 23;
const MAX_WINDOW_DAYS = 3650;

export const ENDPOINT_OBSERVATION_TYPES = ['seller_opened', 'seller_self_send_link', 'suggestions_fetched', 'suggestions_search'] as const;
/** Keys written to intake `request_created` rows before Slice 2. */
export const HISTORICAL_INTAKE_KEYS = ['submitted_property_address', 'canonical_property_address', 'slug', 'suffix'] as const;
/** Provider-name copies written to suggestion events before Slice 9. */
export const HISTORICAL_SUGGESTION_KEYS = ['top_results_by_category', 'top_results'] as const;

type RetentionClassDefinition = {
    /** Letters only: also the job summary key. */
    key: string;
    label: string;
    group: RetentionGroup;
    table: 'ai_result_exposures' | 'ai_selection_observations' | 'event_logs' | 'ai_generation_runs' | 'notification_observations' | 'pdf_render_observations' | 'operational_events' | 'job_runs';
    timestamp: 'created_at' | 'occurred_at' | 'started_at';
    kind: 'delete' | 'scrub';
    /** null: any age (historical cleanup). */
    windowDays: number | null;
    minDays: number;
    /** Static predicate beyond the cutoff. Never built from input. */
    match?: string;
    /** Scrub only: the SET clause. `match` must exclude rows already scrubbed. */
    set?: string;
};

const sqlList = (values: readonly string[]) => values.map((value) => `'${value}'`).join(', ');

export const RETENTION_CLASS_KEYS = [
    'sellerDiagnostics', 'endpointObservations', 'eventIpUserAgent', 'aiRuns', 'aiExposures', 'aiChoices',
    'notificationEvidence', 'pdfEvidence', 'operationalEvents', 'jobRuns',
    'historicalIntakeAddresses', 'historicalSuggestionNames',
] as const;
export type RetentionClassKey = typeof RETENTION_CLASS_KEYS[number];

export function getRetentionClasses(opsRetentionDays = getOpsRetentionDays()): (RetentionClassDefinition & { key: RetentionClassKey })[] {
    return [
        {
            key: 'sellerDiagnostics', label: 'Seller browser diagnostics', group: 'telemetry',
            table: 'event_logs', timestamp: 'created_at', kind: 'delete', windowDays: 90, minDays: 7,
            match: `event_type IN (${sqlList(SELLER_OBSERVATION_EVENT_TYPES)})`,
        },
        {
            key: 'endpointObservations', label: 'Opens, return-link sends, suggestion loads and searches', group: 'telemetry',
            table: 'event_logs', timestamp: 'created_at', kind: 'delete', windowDays: 180, minDays: 7,
            match: `event_type IN (${sqlList(ENDPOINT_OBSERVATION_TYPES)})`,
        },
        {
            key: 'eventIpUserAgent', label: 'IP address and browser header on request events', group: 'telemetry',
            table: 'event_logs', timestamp: 'created_at', kind: 'scrub', windowDays: 30, minDays: 7,
            match: '(ip_address IS NOT NULL OR user_agent IS NOT NULL)',
            set: 'ip_address = NULL, user_agent = NULL',
        },
        {
            // Items go with their run (ON DELETE CASCADE).
            key: 'aiRuns', label: 'AI runs and their suggestion items', group: 'telemetry',
            table: 'ai_generation_runs', timestamp: 'created_at', kind: 'delete', windowDays: 365, minDays: 7,
        },
        {
            key: 'aiExposures', label: 'AI consumer exposures', group: 'telemetry',
            table: 'ai_result_exposures', timestamp: 'created_at', kind: 'delete', windowDays: 365, minDays: 7,
        },
        {
            key: 'aiChoices', label: 'Immutable accepted AI choices', group: 'telemetry',
            table: 'ai_selection_observations', timestamp: 'created_at', kind: 'delete', windowDays: 365, minDays: 7,
        },
        {
            // Never below 30 days, so late delivery callbacks still find their row.
            key: 'notificationEvidence', label: 'Completion and invitation email evidence', group: 'telemetry',
            table: 'notification_observations', timestamp: 'created_at', kind: 'delete', windowDays: 180, minDays: 30,
        },
        {
            key: 'pdfEvidence', label: 'Sheet PDF evidence', group: 'telemetry',
            table: 'pdf_render_observations', timestamp: 'created_at', kind: 'delete', windowDays: 180, minDays: 30,
        },
        {
            key: 'operationalEvents', label: 'Operational incidents', group: 'operations',
            table: 'operational_events', timestamp: 'occurred_at', kind: 'delete', windowDays: opsRetentionDays, minDays: 7,
        },
        {
            key: 'jobRuns', label: 'Scheduled job runs', group: 'operations',
            table: 'job_runs', timestamp: 'started_at', kind: 'delete', windowDays: opsRetentionDays, minDays: 7,
        },
        {
            key: 'historicalIntakeAddresses', label: 'Addresses and link names in old intake creation events', group: 'historical',
            table: 'event_logs', timestamp: 'created_at', kind: 'scrub', windowDays: null, minDays: 0,
            match: `event_type = 'request_created' AND event_data ?| ARRAY[${sqlList(HISTORICAL_INTAKE_KEYS)}]`,
            set: `event_data = event_data - ARRAY[${sqlList(HISTORICAL_INTAKE_KEYS)}]::text[]`,
        },
        {
            key: 'historicalSuggestionNames', label: 'Provider names in old suggestion events', group: 'historical',
            table: 'event_logs', timestamp: 'created_at', kind: 'scrub', windowDays: null, minDays: 0,
            match: `event_type IN ('suggestions_fetched', 'suggestions_search') AND event_data ?| ARRAY[${sqlList(HISTORICAL_SUGGESTION_KEYS)}]`,
            set: `event_data = event_data - ARRAY[${sqlList(HISTORICAL_SUGGESTION_KEYS)}]::text[]`,
        },
    ];
}

/** Anything other than an explicit `preview` or `enforce` is off. */
export function parseRetentionMode(value: string | undefined): RetentionMode {
    const normalized = (value ?? '').trim().toLowerCase();
    return normalized === 'preview' || normalized === 'enforce' ? normalized : 'off';
}

export type RetentionPlanItem = {
    key: RetentionClassKey;
    label: string;
    kind: 'delete' | 'scrub';
    action: RetentionAction;
    windowDays: number | null;
};

type Env = Record<string, string | undefined>;

export function resolveRetentionPlan(env: Env = process.env): { mode: RetentionMode; items: (RetentionPlanItem & { definition: RetentionClassDefinition })[] } {
    const mode = parseRetentionMode(env.TELEMETRY_RETENTION_MODE);
    const opsEnforce = env.OPS_RETENTION_PRUNE_ENABLED === 'true';
    const historicalEnforce = env.TELEMETRY_RETENTION_HISTORICAL_CLEANUP === 'true';

    const items = getRetentionClasses(getOpsRetentionDays(env.OPS_EVENT_RETENTION_DAYS)).map((definition) => {
        let action: RetentionAction;
        if (definition.group === 'operations') action = opsEnforce || mode === 'enforce' ? 'enforce' : mode === 'preview' ? 'preview' : 'skip';
        else if (definition.group === 'historical') action = mode === 'off' ? 'skip' : mode === 'enforce' && historicalEnforce ? 'enforce' : 'preview';
        else action = mode === 'off' ? 'skip' : mode;
        const windowDays = definition.windowDays === null
            ? null
            : Math.min(MAX_WINDOW_DAYS, Math.max(definition.minDays, Math.trunc(definition.windowDays)));
        return { key: definition.key as RetentionClassKey, label: definition.label, kind: definition.kind, action, windowDays, definition };
    });
    return { mode, items };
}

export function buildRetentionStatement(definition: RetentionClassDefinition, windowDays: number | null, action: 'preview' | 'enforce', batchLimit: number) {
    const params: unknown[] = [];
    const conditions: string[] = [];
    if (windowDays !== null) {
        params.push(windowDays);
        // Strictly older than the cutoff. A NULL timestamp never matches, so it is kept.
        conditions.push(`${definition.timestamp} < NOW() - make_interval(days => $${params.length}::int)`);
    }
    if (definition.match) conditions.push(definition.match);
    const where = conditions.length ? conditions.join(' AND ') : 'TRUE';
    const { table, timestamp } = definition;

    if (action === 'preview') {
        return { text: `SELECT COUNT(*)::int AS n, MIN(${timestamp}) AS oldest FROM ${table} WHERE ${where}`, params };
    }
    params.push(batchLimit);
    const batch = `SELECT id FROM ${table} WHERE ${where} ORDER BY ${timestamp} LIMIT $${params.length}::int`;
    const change = definition.kind === 'delete'
        ? `DELETE FROM ${table} WHERE id IN (SELECT id FROM batch) RETURNING 1`
        : `UPDATE ${table} SET ${definition.set} WHERE id IN (SELECT id FROM batch) RETURNING 1`;
    return { text: `WITH batch AS (${batch}), changed AS (${change}) SELECT COUNT(*)::int AS n FROM changed`, params };
}

export type RetentionClassResult = {
    key: RetentionClassKey;
    label: string;
    kind: 'delete' | 'scrub';
    action: 'preview' | 'enforce';
    windowDays: number | null;
    /** Preview: rows the rule would affect now. Enforce: rows changed in this batch. */
    affected: number;
    oldest: string | null;
    failed: boolean;
};

function safeErrorName(error: unknown): string {
    const name = error instanceof Error ? error.name : '';
    return /^[A-Za-z]{1,40}$/.test(name) ? name : 'UnknownError';
}

/** Runs each planned class as its own statement; one failing class does not stop the others. */
export async function runRetention(input: {
    db: StatementExecutor;
    items: (RetentionPlanItem & { definition: RetentionClassDefinition })[];
    batchLimit?: number;
}): Promise<RetentionClassResult[]> {
    const batchLimit = Math.max(1, Math.trunc(input.batchLimit ?? RETENTION_BATCH_LIMIT));
    const results: RetentionClassResult[] = [];
    for (const item of input.items) {
        if (item.action === 'skip') continue;
        const base = { key: item.key, label: item.label, kind: item.kind, action: item.action, windowDays: item.windowDays };
        try {
            const rows = await input.db.run(buildRetentionStatement(item.definition, item.windowDays, item.action, batchLimit));
            const oldest = rows[0]?.oldest;
            results.push({
                ...base,
                affected: Number(rows[0]?.n ?? 0),
                oldest: oldest instanceof Date ? oldest.toISOString() : typeof oldest === 'string' ? oldest : null,
                failed: false,
            });
        } catch (error) {
            console.error(JSON.stringify({
                level: 'error', message: 'Telemetry retention class failed', retentionClass: item.key, errorName: safeErrorName(error),
            }));
            results.push({ ...base, affected: 0, oldest: null, failed: true });
        }
    }
    return results;
}

export type ScheduledRetentionResult =
    | { status: 'not_due'; mode: RetentionMode }
    | { status: 'ran' | 'failed'; mode: RetentionMode; classes: RetentionClassResult[]; failed: number };

/** Job summary: counts only, letter-only keys (see finishJobRun). Action per class: 1 preview, 2 enforce. */
export function retentionSummary(classes: RetentionClassResult[]): Record<string, number> {
    const summary: Record<string, number> = { failed: classes.filter((item) => item.failed).length };
    for (const item of classes) {
        summary[item.key] = item.affected;
        summary[`${item.key}Action`] = item.action === 'enforce' ? 2 : 1;
    }
    return summary;
}

/**
 * Called by the ops monitor. Returns null when every class is off, so nothing
 * is queried. Never throws: a failure is reported, and the monitor marks its
 * own run partial.
 */
export async function runScheduledRetention(input: {
    db: StatementExecutor;
    env?: Env;
    now?: Date;
}): Promise<ScheduledRetentionResult | null> {
    const plan = resolveRetentionPlan(input.env ?? process.env);
    if (plan.items.every((item) => item.action === 'skip')) return null;

    try {
        const rows = await input.db.run({
            text: `SELECT MAX(started_at) AS at FROM job_runs WHERE job_name = 'telemetry_retention'`,
            params: [],
        });
        const lastAt = rows[0]?.at ? new Date(rows[0].at as string | Date).getTime() : null;
        const now = (input.now ?? new Date()).getTime();
        if (lastAt !== null && now - lastAt < RETENTION_MIN_INTERVAL_HOURS * 3_600_000) {
            return { status: 'not_due', mode: plan.mode };
        }
    } catch (error) {
        console.error(JSON.stringify({ level: 'error', message: 'Telemetry retention schedule read failed', errorName: safeErrorName(error) }));
        return { status: 'failed', mode: plan.mode, classes: [], failed: 1 };
    }

    const handle = await startJobRun('telemetry_retention', input.db);
    const classes = await runRetention({ db: input.db, items: plan.items });
    const failed = classes.filter((item) => item.failed).length;
    await finishJobRun(handle, failed ? 'partial' : 'success', retentionSummary(classes), input.db);
    return { status: failed ? 'failed' : 'ran', mode: plan.mode, classes, failed };
}

export type RetentionStatus = {
    mode: RetentionMode;
    plan: RetentionPlanItem[];
    lastRun: { startedAt: string; status: string; summary: Record<string, number> } | null;
};

/** Admin Operations: current configuration plus the last recorded run. */
export async function getRetentionStatus(db: StatementExecutor, env: Env = process.env): Promise<RetentionStatus> {
    const plan = resolveRetentionPlan(env);
    const rows = await db.run({
        text: `
            SELECT started_at, status, summary FROM job_runs
            WHERE job_name = 'telemetry_retention'
            ORDER BY started_at DESC LIMIT 1
        `,
        params: [],
    });
    const row = rows[0];
    const summary: Record<string, number> = {};
    if (row?.summary && typeof row.summary === 'object') {
        for (const [key, value] of Object.entries(row.summary as Record<string, unknown>)) {
            if (typeof value === 'number' && Number.isFinite(value)) summary[key] = value;
        }
    }
    return {
        mode: plan.mode,
        plan: plan.items.map(({ key, label, kind, action, windowDays }) => ({ key, label, kind, action, windowDays })),
        lastRun: row ? {
            startedAt: row.started_at instanceof Date ? row.started_at.toISOString() : String(row.started_at),
            status: String(row.status),
            summary,
        } : null,
    };
}

/** Never throws: Admin renders unavailable rather than an empty policy. */
export async function loadRetentionStatus(env: Env = process.env): Promise<SectionState<RetentionStatus>> {
    try {
        return { status: 'ok', data: await getRetentionStatus(getStatementExecutor(), env) };
    } catch (error) {
        return isMissingRelationError(error) ? { status: 'not_installed' } : { status: 'error' };
    }
}
