/**
 * Quiet operational alerts.
 *
 * Evaluation is a pure function of counts and a clock. Notification state is
 * kept per condition so one alert is sent when a condition starts, one when it
 * recovers, and nothing while it is unchanged.
 *
 * Alerts are disabled unless OPS_ALERTS_ENABLED=true and OPS_ALERT_EMAIL is set.
 * Thresholds are configurable defaults, not validated business benchmarks.
 * Alert text carries counts and an Admin link only: no seller or customer data.
 *
 * These alerts are evaluated from the application database, so they cannot
 * report a database or site outage. That requires an external probe.
 */
import { getResend } from '@/lib/resend';
import { AI_HEALTH_LABELS, loadAiHealth, type AiFeatureHealth, type AiHealthConfig } from '@/lib/ops/ai-health';
import { JOB_LABELS, jobOverdueMinutes, getJobOverdueHours, type JobStatus } from '@/lib/ops/overview';
import { getStatementExecutor, type StatementExecutor } from '@/lib/neon/statements';

export type AlertConfig = {
    enabled: boolean;
    destination: string | null;
    pdfFailureThreshold: number;
    pdfWindowMinutes: number;
    jobOverdueHours: number;
    ai: AiHealthConfig;
};

function positiveInt(value: string | undefined, fallback: number, min: number, max: number) {
    const parsed = Number.parseInt(value || '', 10);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export function getAlertConfig(env: NodeJS.ProcessEnv = process.env): AlertConfig {
    const destination = env.OPS_ALERT_EMAIL?.trim() || null;
    const validDestination = destination && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination) ? destination : null;
    return {
        // Both an explicit switch and a destination are required; either missing means off.
        enabled: env.OPS_ALERTS_ENABLED === 'true' && validDestination !== null,
        destination: validDestination,
        pdfFailureThreshold: positiveInt(env.OPS_ALERT_PDF_FAILURE_THRESHOLD, 3, 1, 1000),
        pdfWindowMinutes: positiveInt(env.OPS_ALERT_PDF_WINDOW_MINUTES, 15, 1, 1440),
        jobOverdueHours: getJobOverdueHours(env),
        ai: {
            sharePct: positiveInt(env.OPS_ALERT_AI_SHARE_PCT, 50, 1, 100),
            minRuns: positiveInt(env.OPS_ALERT_AI_MIN_RUNS, 10, 1, 10000),
            windowHours: positiveInt(env.OPS_ALERT_AI_WINDOW_HOURS, 24, 1, 24 * 7),
        },
    };
}

export type AlertSnapshot = {
    pdfFailuresInWindow: number;
    unrecoveredBillingFailures24h: number;
    emailDeliveryFailures24h: number;
    jobs: JobStatus[];
    aiHealth: AiFeatureHealth[];
};

export type AlertCondition = { key: string; firing: boolean; summary: string; evaluable?: boolean };

export function evaluateAlertConditions(snapshot: AlertSnapshot, config: AlertConfig): AlertCondition[] {
    const conditions: AlertCondition[] = [
        {
            key: 'pdf_failures',
            firing: snapshot.pdfFailuresInWindow >= config.pdfFailureThreshold,
            summary: `${snapshot.pdfFailuresInWindow} unexpected PDF generation failures in the last ${config.pdfWindowMinutes} minutes`,
        },
        {
            key: 'billing_webhook_failure',
            firing: snapshot.unrecoveredBillingFailures24h > 0,
            summary: `${snapshot.unrecoveredBillingFailures24h} billing webhook event(s) failed processing and have not recovered`,
        },
        {
            key: 'email_delivery_failure',
            firing: snapshot.emailDeliveryFailures24h > 0,
            summary: `${snapshot.emailDeliveryFailures24h} email delivery failure(s) (bounce, complaint or send failure) in the last 24 hours`,
        },
    ];

    for (const job of snapshot.jobs) {
        const overdueMinutes = jobOverdueMinutes(job.jobName, config.jobOverdueHours);
        const completed = job.lastStatus !== null && job.lastStatus !== 'running';
        // `not_observed` and `within_grace` never fire: an unobserved job is not an overdue job.
        conditions.push({
            key: `job_overdue:${job.jobName}`,
            firing: job.health === 'overdue',
            summary: `${JOB_LABELS[job.jobName]} has not succeeded in over ${job.jobName === 'ops_monitor' ? `${overdueMinutes} minutes` : `${config.jobOverdueHours} hours`}`,
            evaluable: job.health === 'overdue' || job.lastStatus === 'success',
        });
        conditions.push({
            key: `job_failed:${job.jobName}`,
            firing: job.lastStatus === 'failed',
            summary: `${JOB_LABELS[job.jobName]} failed on its last run`,
            evaluable: job.lastStatus === 'failed' || job.lastStatus === 'success',
        });
        conditions.push({
            key: `job_partial:${job.jobName}`,
            firing: job.lastStatus === 'partial',
            summary: `${JOB_LABELS[job.jobName]} finished with partial coverage or failures`,
            evaluable: job.lastStatus === 'partial' || job.lastStatus === 'success',
        });
        conditions.push({
            key: `job_stuck:${job.jobName}`,
            firing: job.health === 'stuck',
            summary: `${JOB_LABELS[job.jobName]} has a run with no finish recorded after its running grace`,
            evaluable: completed || job.health === 'stuck',
        });
    }

    for (const item of snapshot.aiHealth) {
        conditions.push({
            key: `ai_degraded:${item.feature}`,
            firing: item.firing,
            summary: `${item.degraded} of ${item.runs} ${AI_HEALTH_LABELS[item.feature]} in the last ${config.ai.windowHours} hours`,
            evaluable: item.runs > 0,
        });
    }
    return conditions;
}

export type AlertState = { status: 'firing' | 'ok' };
export type AlertNotification = { key: string; kind: 'firing' | 'recovered'; summary: string };

/**
 * Compares conditions with stored state. A notification is produced only on a
 * transition: ok -> firing starts a new episode, firing -> ok is a recovery.
 * A condition that was never firing produces nothing when it is ok.
 */
export function planAlertNotifications(
    conditions: AlertCondition[],
    states: Map<string, AlertState>
): AlertNotification[] {
    const notifications: AlertNotification[] = [];
    for (const condition of conditions) {
        if (condition.evaluable === false) continue;
        const previous = states.get(condition.key)?.status ?? 'ok';
        if (condition.firing && previous !== 'firing') {
            notifications.push({ key: condition.key, kind: 'firing', summary: condition.summary });
        } else if (!condition.firing && previous === 'firing') {
            notifications.push({ key: condition.key, kind: 'recovered', summary: condition.summary });
        }
    }
    return notifications;
}

export async function loadAlertSnapshot(
    db: StatementExecutor,
    jobs: JobStatus[],
    config: AlertConfig,
    aiHealth?: AiFeatureHealth[] | null
): Promise<AlertSnapshot> {
    const rows = await db.run({
        text: `
            SELECT
                COUNT(*) FILTER (
                    WHERE category = 'pdf' AND outcome = 'failure'
                      AND occurred_at > NOW() - make_interval(mins => $1::int)
                )::int AS pdf_failures,
                COUNT(*) FILTER (
                    WHERE category = 'billing_webhook' AND outcome = 'failure'
                      AND occurred_at > NOW() - INTERVAL '24 hours'
                      AND NOT EXISTS (
                          SELECT 1 FROM operational_events s
                          WHERE s.category = 'billing_webhook' AND s.outcome = 'success'
                            AND s.provider_event_id = operational_events.provider_event_id
                      )
                )::int AS billing_failures,
                COUNT(*) FILTER (
                    WHERE category = 'email' AND outcome = 'failure'
                      AND occurred_at > NOW() - INTERVAL '24 hours'
                )::int AS email_failures
            FROM operational_events
        `,
        params: [config.pdfWindowMinutes],
    });
    return {
        pdfFailuresInWindow: Number(rows[0]?.pdf_failures ?? 0),
        unrecoveredBillingFailures24h: Number(rows[0]?.billing_failures ?? 0),
        emailDeliveryFailures24h: Number(rows[0]?.email_failures ?? 0),
        jobs,
        // null is an explicitly failed read, not a request to retry or infer recovery.
        aiHealth: aiHealth === undefined ? await loadAiHealth(db, config.ai) : aiHealth ?? [],
    };
}

export async function loadAlertStates(db: StatementExecutor): Promise<Map<string, AlertState>> {
    const rows = await db.run({ text: `SELECT alert_key, status FROM ops_alert_state`, params: [] });
    return new Map(rows.map((row) => [String(row.alert_key), { status: row.status as 'firing' | 'ok' }]));
}

async function saveAlertState(db: StatementExecutor, notification: AlertNotification) {
    await db.run({
        text: `
            INSERT INTO ops_alert_state (alert_key, status, episode_started_at, last_notified_at)
            VALUES ($1, $2, CASE WHEN $2 = 'firing' THEN NOW() END, NOW())
            ON CONFLICT (alert_key) DO UPDATE SET
                status = EXCLUDED.status,
                episode_started_at = CASE WHEN EXCLUDED.status = 'firing' THEN NOW() ELSE ops_alert_state.episode_started_at END,
                last_notified_at = NOW(),
                updated_at = NOW()
        `,
        params: [notification.key, notification.kind === 'firing' ? 'firing' : 'ok'],
    });
}

export type AlertNotifier = (message: { to: string; subject: string; text: string }) => Promise<boolean>;

/** Default adapter: the existing transactional email provider. */
export const sendAlertEmail: AlertNotifier = async ({ to, subject, text }) => {
    try {
        const { error } = await getResend().emails.send({
            from: 'UtilitySheet Operations <noreply@utilitysheet.com>',
            to,
            subject,
            text,
        });
        return !error;
    } catch {
        return false;
    }
};

function adminOperationsUrl() {
    const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
    return base ? `${base}/admin/operations` : '/admin/operations';
}

export function buildAlertMessage(notification: AlertNotification): { subject: string; text: string } {
    const recovered = notification.kind === 'recovered';
    return {
        subject: recovered
            ? `[UtilitySheet] Recovered: ${notification.key}`
            : `[UtilitySheet] Needs attention: ${notification.key}`,
        text: [
            recovered ? 'This condition is no longer active.' : notification.summary + '.',
            '',
            `Review: ${adminOperationsUrl()}`,
            '',
            'This message contains counts only. You will not receive another message for this condition until it changes.',
        ].join('\n'),
    };
}

export type AlertRunResult = {
    enabled: boolean;
    conditionsFiring: string[];
    planned: AlertNotification[];
    sent: number;
    failed: number;
    /** Accepted notification whose dedup/recovery state could not be saved. */
    stateWriteFailed: number;
};

/**
 * Evaluates conditions and sends at most one message per transition. State is
 * advanced only after a successful send, so a failed notification is retried on
 * the next evaluation rather than lost. When alerts are disabled nothing is
 * sent and no state changes; the result still lists what would have fired.
 */
export async function runAlertEvaluation(input: {
    jobs: JobStatus[];
    config?: AlertConfig;
    db?: StatementExecutor;
    notify?: AlertNotifier;
    /** Already loaded by the monitor; read here when omitted. */
    aiHealth?: AiFeatureHealth[] | null;
}): Promise<AlertRunResult> {
    const db = input.db ?? getStatementExecutor();
    const config = input.config ?? getAlertConfig();
    const notify = input.notify ?? sendAlertEmail;

    const snapshot = await loadAlertSnapshot(db, input.jobs, config, input.aiHealth);
    const conditions = evaluateAlertConditions(snapshot, config);
    const planned = planAlertNotifications(conditions, await loadAlertStates(db));
    const result: AlertRunResult = {
        enabled: config.enabled,
        conditionsFiring: conditions.filter((condition) => condition.firing).map((condition) => condition.key),
        planned,
        sent: 0,
        failed: 0,
        stateWriteFailed: 0,
    };
    if (!config.enabled || !config.destination) return result;

    for (const notification of planned) {
        let delivered = false;
        try { delivered = await notify({ to: config.destination, ...buildAlertMessage(notification) }); }
        catch { /* A rejected adapter is an unsuccessful notification. */ }
        if (delivered) {
            result.sent += 1;
            try { await saveAlertState(db, notification); }
            catch {
                // The provider accepted it; another run may repeat it without saved state.
                result.stateWriteFailed += 1;
                result.failed += 1;
            }
        } else {
            result.failed += 1;
        }
    }
    return result;
}
