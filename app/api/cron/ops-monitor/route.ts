import { NextResponse } from 'next/server';

import { observeAiHealth } from '@/lib/ops/ai-health';
import { getAlertConfig, runAlertEvaluation } from '@/lib/ops/alerts';
import { finishJobRun, startJobRun } from '@/lib/ops/events';
import { getJobStatuses } from '@/lib/ops/overview';
import { getStatementExecutor, isMissingRelationError } from '@/lib/neon/statements';
import { runScheduledRetention, type ScheduledRetentionResult } from '@/lib/telemetry/retention';

/**
 * Evaluates alert conditions and, when enabled, applies retention
 * (lib/telemetry/retention.ts, at most once a day).
 * It also records an operational event when too many fresh AI runs end badly
 * (lib/ops/ai-health.ts), so that shows on Admin Operations with alerts off.
 *
 * Scheduled every 15 minutes in vercel.json. OPS_ALERTS_ENABLED,
 * OPS_RETENTION_PRUNE_ENABLED and TELEMETRY_RETENTION_MODE are separate
 * owner-approved release steps (docs/admin-operations-runbook.md). Without
 * those flags it sends and deletes nothing. A retention failure makes the run
 * partial and never stops alert evaluation.
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
        const alerts = await runAlertEvaluation({ db, jobs: await getJobStatuses(db, new Date(), config.jobOverdueHours, jobRun.id), config, aiHealth: ai.health });
        const retention: ScheduledRetentionResult | null = await runScheduledRetention({ db });
        const retentionFailed = retention && retention.status === 'failed' ? 1 : 0;
        const monitoringStatus = ai.status === 'ok' && alerts.failed === 0 && jobRun.id && !retentionFailed ? 'success' : 'partial';

        await finishJobRun(jobRun, monitoringStatus, {
            firing: alerts.conditionsFiring.length,
            sent: alerts.sent,
            failed: alerts.failed,
            aiDegraded: ai.failures,
            aiRecovered: ai.recoveries,
            aiUnavailable: ai.status === 'unavailable' ? 1 : 0,
            aiPartial: ai.status === 'partial' ? 1 : 0,
            alertStateWriteFailed: alerts.stateWriteFailed,
            retentionRan: retention && retention.status !== 'not_due' ? 1 : 0,
            retentionFailed,
        });
        return NextResponse.json({
            monitoringStatus,
            aiCoverage: ai.status,
            alertsEnabled: alerts.enabled,
            conditionsFiring: alerts.conditionsFiring,
            notificationsPlanned: alerts.planned.map(({ key, kind }) => ({ key, kind })),
            sent: alerts.sent,
            failed: alerts.failed,
            stateWriteFailed: alerts.stateWriteFailed,
            retention: retention && retention.status !== 'not_due'
                ? { status: retention.status, mode: retention.mode, classes: retention.classes.map(({ key, action, affected, failed }) => ({ key, action, affected, failed })) }
                : retention,
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
