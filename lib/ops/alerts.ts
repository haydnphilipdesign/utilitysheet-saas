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
import { JOB_LABELS, type JobStatus } from '@/lib/ops/overview';
import { getStatementExecutor, type StatementExecutor } from '@/lib/neon/statements';

export type AlertConfig = {
    enabled: boolean;
    destination: string | null;
    pdfFailureThreshold: number;
    pdfWindowMinutes: number;
    jobOverdueHours: number;
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
        jobOverdueHours: positiveInt(env.OPS_ALERT_JOB_OVERDUE_HOURS, 26, 1, 24 * 14),
    };
}

export type AlertSnapshot = {
    pdfFailuresInWindow: number;
    unrecoveredBillingFailures24h: number;
    emailDeliveryFailures24h: number;
    jobs: JobStatus[];
};

export type AlertCondition = { key: string; firing: boolean; summary: string };

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
        // `not_observed` and `within_grace` never fire: an unobserved job is not an overdue job.
        conditions.push({
            key: `job_overdue:${job.jobName}`,
            firing: job.health === 'overdue',
            summary: `${JOB_LABELS[job.jobName]} has not succeeded in over ${config.jobOverdueHours} hours`,
        });
        conditions.push({
            key: `job_failed:${job.jobName}`,
            firing: job.health === 'failed',
            summary: `${JOB_LABELS[job.jobName]} failed on its last run`,
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
        const previous = states.get(condition.key)?.status ?? 'ok';
        if (condition.firing && previous !== 'firing') {
            notifications.push({ key: condition.key, kind: 'firing', summary: condition.summary });
        } else if (!condition.firing && previous === 'firing') {
            notifications.push({ key: condition.key, kind: 'recovered', summary: condition.summary });
        }
    }
    return notifications;
}

export async function loadAlertSnapshot(db: StatementExecutor, jobs: JobStatus[], config: AlertConfig): Promise<AlertSnapshot> {
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
}): Promise<AlertRunResult> {
    const db = input.db ?? getStatementExecutor();
    const config = input.config ?? getAlertConfig();
    const notify = input.notify ?? sendAlertEmail;

    const snapshot = await loadAlertSnapshot(db, input.jobs, config);
    const conditions = evaluateAlertConditions(snapshot, config);
    const planned = planAlertNotifications(conditions, await loadAlertStates(db));
    const result: AlertRunResult = {
        enabled: config.enabled,
        conditionsFiring: conditions.filter((condition) => condition.firing).map((condition) => condition.key),
        planned,
        sent: 0,
        failed: 0,
    };
    if (!config.enabled || !config.destination) return result;

    for (const notification of planned) {
        const delivered = await notify({ to: config.destination, ...buildAlertMessage(notification) });
        if (delivered) {
            await saveAlertState(db, notification);
            result.sent += 1;
        } else {
            result.failed += 1;
        }
    }
    return result;
}
