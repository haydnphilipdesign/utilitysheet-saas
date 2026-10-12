import { NextResponse } from 'next/server';

import { observeAiHealth } from '@/lib/ops/ai-health';
import { getAlertConfig, runAlertEvaluation } from '@/lib/ops/alerts';
import { finishJobRun, getOpsRetentionDays, pruneOperationalObservations, startJobRun } from '@/lib/ops/events';
import { getJobStatuses } from '@/lib/ops/overview';
import { getStatementExecutor, isMissingRelationError } from '@/lib/neon/statements';

/**
 * Evaluates alert conditions and, when enabled, prunes expired observations.
 * It also records an operational event when too many fresh AI runs end badly
 * (lib/ops/ai-health.ts), so that shows on Admin Operations with alerts off.
 *
 * Scheduled every 15 minutes in vercel.json. OPS_ALERTS_ENABLED and
 * OPS_RETENTION_PRUNE_ENABLED are separate owner-approved release steps
 * (docs/admin-operations-runbook.md). Without those flags it sends and deletes
 * nothing.
 */
export async function GET(request: Request) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        console.error(JSON.stringify({ level: 'error', message: 'Ops monitor missing CRON_SECRET', route: '/api/cron/ops-monitor' }));
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const jobRun = await startJobRun('ops_monitor');
    try {
        const db = getStatementExecutor();
        const config = getAlertConfig();
        const ai = await observeAiHealth({ db, config: config.ai });
        const alerts = await runAlertEvaluation({ db, jobs: await getJobStatuses(db), config, aiHealth: ai.health ?? [] });

        let pruned: { events: number; jobRuns: number } | null = null;
        if (process.env.OPS_RETENTION_PRUNE_ENABLED === 'true') {
            pruned = await pruneOperationalObservations({ db, retentionDays: getOpsRetentionDays() });
        }

        await finishJobRun(jobRun, alerts.failed > 0 ? 'partial' : 'success', {
            firing: alerts.conditionsFiring.length,
            sent: alerts.sent,
            failed: alerts.failed,
            aiDegraded: ai.failures,
            aiRecovered: ai.recoveries,
            prunedEvents: pruned?.events ?? 0,
            prunedJobRuns: pruned?.jobRuns ?? 0,
        });
        return NextResponse.json({
            alertsEnabled: alerts.enabled,
            conditionsFiring: alerts.conditionsFiring,
            notificationsPlanned: alerts.planned.map(({ key, kind }) => ({ key, kind })),
            sent: alerts.sent,
            failed: alerts.failed,
            pruned,
        });
    } catch (error) {
        await finishJobRun(jobRun, 'failed');
        if (isMissingRelationError(error)) {
            return NextResponse.json({ error: 'Operational monitoring is not installed (migration pending)' }, { status: 503 });
        }
        console.error(JSON.stringify({
            level: 'error',
            message: 'Ops monitor failed',
            route: '/api/cron/ops-monitor',
            errorName: error instanceof Error ? error.name : typeof error,
        }));
        return NextResponse.json({ error: 'Ops monitor failed' }, { status: 500 });
    }
}
