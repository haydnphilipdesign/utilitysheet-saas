/**
 * AI health: how many fresh AI runs ended badly, per feature.
 *
 * Read from ai_generation_runs by the scheduled ops monitor, never inside a
 * seller's request. A run counts as degraded when:
 *   - provider suggestions ended on the generic list (whatever the cause);
 *   - a provider search or contact lookup failed at the model call. An empty
 *     search or a contact that was not found is a normal answer, not a failure.
 *
 * When the degraded share of a feature passes the threshold the monitor records
 * one 'ai' operational event (shown on Admin Operations) and the matching alert
 * condition fires. Cache hits are ignored: they say nothing about the model.
 * Thresholds are configurable defaults, not validated business benchmarks.
 */
import { errorNameOf, recordOperationalEvent } from '@/lib/ops/events';
import type { StatementExecutor } from '@/lib/neon/statements';

export const AI_HEALTH_FEATURES = ['provider_suggestions', 'provider_search', 'provider_contact'] as const;
export type AiHealthFeature = (typeof AI_HEALTH_FEATURES)[number];

export type AiHealthConfig = {
    /** Degraded share, in percent of fresh runs, at which a feature is reported. */
    sharePct: number;
    /** Fewer fresh runs than this in the window is too little to judge. */
    minRuns: number;
    windowHours: number;
};

export type AiFeatureHealth = {
    feature: AiHealthFeature;
    runs: number;
    degraded: number;
    firing: boolean;
};

export const AI_HEALTH_LABELS: Record<AiHealthFeature, string> = {
    provider_suggestions: 'fresh provider suggestion lookups ended on the generic list',
    provider_search: 'fresh provider searches failed at the model call',
    provider_contact: 'fresh contact lookups failed at the model call',
};

export function aiHealthCode(feature: AiHealthFeature): string {
    return `${feature}_degraded`;
}

/** Pure, so thresholds can be tested without a database. */
export function isAiHealthFiring(runs: number, degraded: number, config: AiHealthConfig): boolean {
    return runs >= config.minRuns && degraded * 100 >= config.sharePct * runs;
}

/** Always returns every feature, so a quiet window reads as zero runs, not as missing. */
export async function loadAiHealth(db: StatementExecutor, config: AiHealthConfig): Promise<AiFeatureHealth[]> {
    const rows = await db.run({
        text: `
            SELECT feature,
                COUNT(*)::int AS runs,
                COUNT(*) FILTER (
                    WHERE (feature = 'provider_suggestions' AND source = 'fallback')
                       OR (feature <> 'provider_suggestions' AND status IN ('error', 'parse_error'))
                )::int AS degraded
            FROM ai_generation_runs
            WHERE cache_hit = FALSE
              AND feature = ANY($1::text[])
              AND created_at > NOW() - make_interval(hours => $2::int)
            GROUP BY feature
        `,
        params: [[...AI_HEALTH_FEATURES], config.windowHours],
    });
    const byFeature = new Map(rows.map((row) => [String(row.feature), row] as const));
    return AI_HEALTH_FEATURES.map((feature) => {
        const runs = Number(byFeature.get(feature)?.runs ?? 0) || 0;
        const degraded = Number(byFeature.get(feature)?.degraded ?? 0) || 0;
        return { feature, runs, degraded, firing: isAiHealthFiring(runs, degraded, config) };
    });
}

/**
 * Records the start of a degraded episode, one repeat per window while it
 * lasts, and its recovery. Recovery needs evidence: at least one fresh run in
 * the window and a share back under the threshold.
 */
export async function recordAiHealthObservations(
    db: StatementExecutor,
    health: AiFeatureHealth[],
    config: AiHealthConfig
): Promise<{ failures: number; recoveries: number }> {
    const rows = await db.run({
        text: `
            SELECT fingerprint,
                COALESCE(last_failure > NOW() - make_interval(hours => $1::int), FALSE) AS recent,
                (last_failure IS NOT NULL AND (last_success IS NULL OR last_success <= last_failure)) AS open
            FROM (
                SELECT fingerprint,
                    MAX(occurred_at) FILTER (WHERE outcome = 'failure') AS last_failure,
                    MAX(occurred_at) FILTER (WHERE outcome = 'success') AS last_success
                FROM operational_events
                WHERE category = 'ai'
                GROUP BY fingerprint
            ) episodes
        `,
        params: [config.windowHours],
    });
    const episodes = new Map(rows.map((row) => [String(row.fingerprint), { recent: row.recent === true, open: row.open === true }] as const));

    const result = { failures: 0, recoveries: 0 };
    for (const item of health) {
        const code = aiHealthCode(item.feature);
        const episode = episodes.get(`ai:${code}`) ?? { recent: false, open: false };
        const metadata = { runCount: item.runs, failedCount: item.degraded, windowHours: config.windowHours };

        if (item.firing && !(episode.open && episode.recent)) {
            if (await recordOperationalEvent({ db, category: 'ai', code, outcome: 'failure', metadata })) result.failures += 1;
        } else if (!item.firing && episode.open && item.runs > 0 && item.degraded * 100 < config.sharePct * item.runs) {
            if (await recordOperationalEvent({ db, category: 'ai', code, outcome: 'success', severity: 'info', metadata })) result.recoveries += 1;
        }
    }
    return result;
}

/**
 * Monitor entry point. Never throws: a failed read is logged and reported as
 * "not observed" so the other alert conditions are still evaluated.
 */
export async function observeAiHealth(input: { db: StatementExecutor; config: AiHealthConfig }): Promise<{
    health: AiFeatureHealth[] | null;
    failures: number;
    recoveries: number;
}> {
    const logFailure = (message: string, error: unknown) => console.error(JSON.stringify({
        level: 'error',
        message,
        errorName: errorNameOf(error),
    }));

    let health: AiFeatureHealth[];
    try {
        health = await loadAiHealth(input.db, input.config);
    } catch (error) {
        logFailure('ai_health_not_observed', error);
        return { health: null, failures: 0, recoveries: 0 };
    }
    try {
        return { health, ...(await recordAiHealthObservations(input.db, health, input.config)) };
    } catch (error) {
        logFailure('ai_health_not_recorded', error);
        return { health, failures: 0, recoveries: 0 };
    }
}
