// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSchemaDatabase, pgliteExecutor, queryRows } from '../helpers/pglite-db';

vi.mock('@/lib/resend', () => ({ getResend: vi.fn() }));

import type { StatementExecutor } from '@/lib/neon/statements';
import type { AdminActor } from '@/lib/neon/queries/admin-writes';
import {
    buildAlertMessage,
    evaluateAlertConditions,
    getAlertConfig,
    planAlertNotifications,
    runAlertEvaluation,
    type AlertConfig,
} from '@/lib/ops/alerts';
import { applyEmailDeliveryEvent, deliveryStatusForEventType } from '@/lib/ops/email-delivery';
import {
    finishJobRun,
    getOpsRetentionDays,
    pruneOperationalObservations,
    recordOperationalEvent,
    recordOperationalSuccess,
    sanitizeOperationalMetadata,
    startJobRun,
} from '@/lib/ops/events';
import {
    classifyJob,
    describeCollection,
    getFollowUpCandidates,
    getIncidentSummary,
    getJobStatuses,
    getOperationsSnapshot,
    getReminderEmailSummary,
} from '@/lib/ops/overview';
import { applyTriageAction, effectiveTriageState, getTriageRecords, triageKindForSourceKey } from '@/lib/ops/triage';

// Real schema.sql (which mirrors all three new migrations) in disposable embedded PostgreSQL.
const ADMIN = '00000000-0000-4000-8000-0000000000a1';
const ADMIN_2 = '00000000-0000-4000-8000-0000000000a2';
const OWNER = '00000000-0000-4000-8000-0000000000b1';
const IDLE = '00000000-0000-4000-8000-0000000000b2';
const REQ = '00000000-0000-4000-8000-0000000000d1';
const OP = '00000000-0000-4000-8000-0000000000e1';

let db: PGlite;
let exec: StatementExecutor;
const actor: AdminActor = { adminId: ADMIN, ipAddress: null, userAgent: 'vitest' };
const one = async (text: string, params: unknown[] = []) => (await queryRows(db, text, params))[0];
const count = async (text: string) => Number((await one(text)).n);
const hours = (n: number) => n * 60 * 60 * 1000;

beforeAll(async () => {
    db = await createSchemaDatabase();
    exec = pgliteExecutor(db);
}, 60000);
afterAll(async () => { await db?.close(); });

beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await db.exec(`
        TRUNCATE admin_triage_items, ops_alert_state, job_runs, operational_events, reminder_operations,
            admin_audit_logs, event_logs, requests, accounts CASCADE;
        INSERT INTO accounts (id, email, role, created_at) VALUES
            ('${ADMIN}', 'admin@example.com', 'admin', NOW()), ('${ADMIN_2}', 'admin2@example.com', 'admin', NOW()),
            ('${OWNER}', 'owner@example.com', 'user', NOW()), ('${IDLE}', 'idle@example.com', 'user', NOW() - INTERVAL '30 days');
        INSERT INTO requests (id, account_id, property_address, seller_email, status, public_token, seller_token, last_activity_at)
            VALUES ('${REQ}', '${OWNER}', '1 Open St', 'sam@example.com', 'sent', 'pub1', 'sel1', NOW() - INTERVAL '10 days');
        INSERT INTO reminder_operations (id, request_id, actor_type, recipient_email, payload_fingerprint, state, provider_message_id, accepted_at)
            VALUES ('${OP}', '${REQ}', 'agent', 'sam@example.com', '${'a'.repeat(64)}', 'accepted', 'msg_1', NOW());
    `);
});

describe('schema mirror', () => {
    it('applies each new migration idempotently on top of schema.sql', async () => {
        const { readFileSync } = await import('node:fs');
        for (const file of ['migrations-reminder-operations.sql', 'migrations-operational-events.sql', 'migrations-admin-triage.sql']) {
            await db.exec(readFileSync(file, 'utf8'));
            await db.exec(readFileSync(file, 'utf8'));
        }
        expect(await count(`SELECT COUNT(*)::int AS n FROM information_schema.tables
            WHERE table_name IN ('reminder_operations','operational_events','job_runs','ops_alert_state','admin_triage_items')`)).toBe(5);
    });

    it('creates the same tables from the migrations alone as schema.sql declares', async () => {
        const { readFileSync } = await import('node:fs');
        const fresh = new PGlite();
        await fresh.exec(`
            CREATE TABLE accounts (id UUID PRIMARY KEY);
            CREATE TABLE requests (id UUID PRIMARY KEY);
        `);
        for (const file of ['migrations-reminder-operations.sql', 'migrations-operational-events.sql', 'migrations-admin-triage.sql']) {
            await fresh.exec(readFileSync(file, 'utf8'));
        }
        const columns = async (target: PGlite) => (await target.query<{ c: string }>(`
            SELECT table_name || '.' || column_name || ':' || data_type AS c FROM information_schema.columns
            WHERE table_name IN ('reminder_operations','operational_events','job_runs','ops_alert_state','admin_triage_items')
            ORDER BY 1`)).rows.map((row) => row.c);
        expect(await columns(fresh)).toEqual(await columns(db));
        await fresh.close();
    });

    it('lets customer records be deleted without operational history blocking them', async () => {
        await recordOperationalEvent({ db: exec, category: 'email', code: 'completion_send_failed', outcome: 'failure', requestId: REQ, accountId: OWNER });
        await db.exec(`DELETE FROM accounts WHERE id = '${OWNER}'`);
        expect(await one('SELECT request_id, account_id FROM operational_events')).toEqual({ request_id: null, account_id: null });
        expect(await count('SELECT COUNT(*)::int AS n FROM reminder_operations')).toBe(0);
    });
});

describe('operational events', () => {
    it('stores only allowlisted scalar metadata', async () => {
        expect(sanitizeOperationalMetadata({
            eventType: 'customer.subscription.updated', errorName: 'TypeError', failedCount: 2,
            url: 'https://app/s/secret-token', sellerEmail: 'sam@example.com', reasonCode: 'has spaces and <html>',
            nested: { a: 1 }, message: 'raw exception text',
        })).toEqual({ eventType: 'customer.subscription.updated', errorName: 'TypeError', failedCount: 2 });

        await recordOperationalEvent({
            db: exec, category: 'pdf', code: 'generation_failed', outcome: 'failure', requestId: 'not-a-uuid',
            metadata: { errorName: 'Error', token: 'secret-token', body: '<html>' },
        });
        const row = await one('SELECT request_id, metadata, fingerprint, severity FROM operational_events');
        expect(row).toEqual({ request_id: null, metadata: { errorName: 'Error' }, fingerprint: 'pdf:generation_failed', severity: 'warning' });
    });

    it('never throws: an unavailable store falls back to a redacted log line', async () => {
        const broken: StatementExecutor = {
            run: async () => { throw Object.assign(new Error('relation "operational_events" does not exist'), { code: '42P01' }); },
            transaction: async () => [],
        };
        const input = { db: broken, category: 'pdf' as const, code: 'generation_failed', metadata: { errorName: 'Error' } };
        expect(await recordOperationalEvent({ ...input, outcome: 'failure' })).toBe(false);
        expect(await recordOperationalSuccess(input)).toBe(false);
        const handle = await startJobRun('activation_reconcile', broken);
        expect(handle.id).toBeNull();
        await expect(finishJobRun(handle, 'success', {}, broken)).resolves.toBeUndefined();
        const logged = (console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((call) => String(call[0])).join('\n');
        expect(logged).toContain('operational_event_not_recorded');
        expect(logged).not.toContain('does not exist');
    });

    it('deduplicates provider redeliveries and links recovery by provider event identity', async () => {
        const failure = () => recordOperationalEvent({
            db: exec, category: 'billing_webhook', code: 'processing_failed', outcome: 'failure', severity: 'critical',
            providerEventId: 'evt_1', metadata: { eventType: 'customer.subscription.updated' },
        });
        await failure(); await failure(); await failure();
        expect(await one('SELECT COUNT(*)::int AS n, MAX(attempts) AS attempts FROM operational_events')).toEqual({ n: 1, attempts: 3 });

        let summary = await getIncidentSummary(exec);
        expect(summary.incidents).toMatchObject([{ fingerprint: 'billing_webhook:processing_failed', severity: 'critical', occurrences: 1, unrecovered: 1 }]);

        // A different event succeeding is not a recovery of evt_1.
        await db.exec(`UPDATE operational_events SET occurred_at = NOW() - INTERVAL '1 hour'`);
        await recordOperationalSuccess({ db: exec, category: 'billing_webhook', code: 'processing_failed', providerEventId: 'evt_other' });
        summary = await getIncidentSummary(exec);
        expect(summary.incidents[0]).toMatchObject({ unrecovered: 1 });
        expect(summary.incidents[0].lastSuccessAt).not.toBeNull();

        await recordOperationalSuccess({ db: exec, category: 'billing_webhook', code: 'processing_failed', providerEventId: 'evt_1' });
        await recordOperationalSuccess({ db: exec, category: 'billing_webhook', code: 'processing_failed', providerEventId: 'evt_1' });
        expect((await getIncidentSummary(exec)).incidents[0]).toMatchObject({ occurrences: 1, unrecovered: 0 });
    });

    it('samples routine success instead of writing on every request', async () => {
        for (let i = 0; i < 5; i += 1) await recordOperationalSuccess({ db: exec, category: 'pdf', code: 'generation_failed' });
        expect(await count(`SELECT COUNT(*)::int AS n FROM operational_events WHERE outcome = 'success'`)).toBe(1);
    });

    it('treats a later success as recovery for failures without a provider identity', async () => {
        await recordOperationalEvent({ db: exec, category: 'pdf', code: 'generation_failed', outcome: 'failure', requestId: REQ });
        await db.exec(`UPDATE operational_events SET occurred_at = NOW() - INTERVAL '2 hours'`);
        expect((await getIncidentSummary(exec)).incidents[0]).toMatchObject({ unrecovered: 1, latestRequestId: REQ, sourceKey: 'incident:pdf:generation_failed' });
        await recordOperationalSuccess({ db: exec, category: 'pdf', code: 'generation_failed' });
        expect((await getIncidentSummary(exec)).incidents[0]).toMatchObject({ unrecovered: 0 });
    });
});

describe('page states', () => {
    it('separates not installed, no observations, stale and current', async () => {
        const bare = pgliteExecutor(new PGlite());
        const missing = await getOperationsSnapshot({ db: bare });
        expect([missing.incidents.status, missing.jobs.status, missing.reminders.status, missing.followUp.status])
            .toEqual(['not_installed', 'not_installed', 'not_installed', 'not_installed']);

        const failing: StatementExecutor = { run: async () => { throw new Error('connection reset'); }, transaction: async () => [] };
        expect((await getOperationsSnapshot({ db: failing })).incidents.status).toBe('error');

        const now = new Date();
        const empty = await getIncidentSummary(exec);
        expect(empty.incidents).toEqual([]);
        expect(describeCollection(empty, now)).toBe('no_observations');

        await recordOperationalSuccess({ db: exec, category: 'pdf', code: 'generation_failed' });
        const current = await getIncidentSummary(exec);
        expect(current.incidents).toEqual([]);
        expect(describeCollection(current, now)).toBe('current');
        expect(describeCollection(current, new Date(now.getTime() + hours(72)))).toBe('stale');
    });
});

describe('scheduled jobs', () => {
    const base = { jobName: 'activation_reconcile' as const, lastDurationMs: 10 };
    const now = new Date('2026-10-05T12:00:00Z');
    const ago = (h: number) => new Date(now.getTime() - hours(h)).toISOString();

    it('never calls an unobserved job overdue and honours the initial grace window', () => {
        expect(classifyJob({ ...base, firstObservedAt: null, lastStartedAt: null, lastStatus: null, lastSuccessAt: null }, now)).toBe('not_observed');
        expect(classifyJob({ ...base, firstObservedAt: ago(2), lastStartedAt: ago(2), lastStatus: 'running', lastSuccessAt: null }, now)).toBe('within_grace');
        expect(classifyJob({ ...base, firstObservedAt: ago(27), lastStartedAt: ago(27), lastStatus: 'running', lastSuccessAt: null }, now)).toBe('overdue');
    });

    it('distinguishes ok, partial, failed and overdue', () => {
        const seen = { ...base, firstObservedAt: ago(200) };
        expect(classifyJob({ ...seen, lastStartedAt: ago(1), lastStatus: 'success', lastSuccessAt: ago(1) }, now)).toBe('ok');
        expect(classifyJob({ ...seen, lastStartedAt: ago(1), lastStatus: 'partial', lastSuccessAt: ago(25) }, now)).toBe('partial');
        expect(classifyJob({ ...seen, lastStartedAt: ago(1), lastStatus: 'failed', lastSuccessAt: ago(25) }, now)).toBe('failed');
        expect(classifyJob({ ...seen, lastStartedAt: ago(1), lastStatus: 'failed', lastSuccessAt: ago(27) }, now)).toBe('overdue');
        expect(classifyJob({ ...seen, lastStartedAt: ago(30), lastStatus: 'success', lastSuccessAt: ago(25.9) }, now)).toBe('ok');
        expect(classifyJob({ ...seen, lastStartedAt: ago(30), lastStatus: 'success', lastSuccessAt: ago(26.1) }, now)).toBe('overdue');
    });

    it('records runs with count-only summaries and reports only the three scheduled jobs', async () => {
        const run = await startJobRun('activation_reconcile', exec);
        await finishJobRun(run, 'partial', { created: 2, failures: 1, emails: ['a@example.com'], note: 'text' }, exec);
        const other = await startJobRun('ops_monitor', exec);
        await finishJobRun(other, 'success', {}, exec);
        expect((await one(`SELECT summary, status FROM job_runs WHERE job_name = 'activation_reconcile'`)))
            .toEqual({ summary: { created: 2, failures: 1 }, status: 'partial' });

        const jobs = await getJobStatuses(exec);
        expect(jobs.map((job) => [job.jobName, job.health])).toEqual([
            ['activation_reconcile', 'partial'], ['activation_reengagement', 'not_observed'], ['account_closure_retry', 'not_observed'],
        ]);
    });
});

describe('email delivery evidence', () => {
    const apply = (status: Parameters<typeof applyEmailDeliveryEvent>[0]['status'], id: string, message = 'msg_1') =>
        applyEmailDeliveryEvent({ db: exec, providerMessageId: message, status, webhookMessageId: id });
    const status = async () => (await one('SELECT delivery_status FROM reminder_operations')).delivery_status;

    it('maps only delivery facts', () => {
        expect(deliveryStatusForEventType('email.bounced')).toBe('bounced');
        expect(deliveryStatusForEventType('email.delivery_delayed')).toBe('delayed');
        for (const type of ['email.sent', 'email.opened', 'email.clicked', 'contact.created', 42, null]) {
            expect(deliveryStatusForEventType(type)).toBeNull();
        }
    });

    it('never lets a late or duplicate event regress a bounce or complaint, and keeps distinct facts', async () => {
        expect(await apply('delayed', 'wh_1')).toEqual({ matched: true });
        expect(await status()).toBe('delayed');
        await apply('delivered', 'wh_2');
        await apply('bounced', 'wh_3');
        await apply('complained', 'wh_4');
        // Out of order and duplicated.
        await apply('delivered', 'wh_2');
        await apply('delivered', 'wh_5');
        await apply('bounced', 'wh_3');
        expect(await status()).toBe('complained');

        const events = await queryRows(db, `SELECT code, outcome, attempts, request_id FROM operational_events ORDER BY code, provider_event_id`);
        expect(events.map((event) => [event.code, event.outcome, event.attempts])).toEqual([
            ['reminder_bounced', 'failure', 2], ['reminder_complained', 'failure', 1],
            ['reminder_delivered', 'success', 2], ['reminder_delivered', 'success', 1],
        ]);
        expect(events.every((event) => event.request_id === REQ)).toBe(true);

        const summary = await getReminderEmailSummary(exec);
        expect(summary).toMatchObject({ accepted: 1, complained: 1, bounced: 0, delivered: 0, deliveryUnknown: 0 });
    });

    it('stores nothing for a message it cannot correlate', async () => {
        expect(await apply('bounced', 'wh_9', 'msg_unknown')).toEqual({ matched: false });
        expect(await count('SELECT COUNT(*)::int AS n FROM operational_events')).toBe(0);
        expect(await status()).toBeNull();
        expect((await getReminderEmailSummary(exec)).deliveryUnknown).toBe(1);
    });
});

describe('alerts', () => {
    const config: AlertConfig = { enabled: true, destination: 'owner@example.com', pdfFailureThreshold: 3, pdfWindowMinutes: 15, jobOverdueHours: 26 };
    const pdfFailure = () => recordOperationalEvent({ db: exec, category: 'pdf', code: 'generation_failed', outcome: 'failure' });

    it('is off unless both the switch and a valid destination are set', () => {
        expect(getAlertConfig({} as NodeJS.ProcessEnv).enabled).toBe(false);
        expect(getAlertConfig({ OPS_ALERTS_ENABLED: 'true' } as unknown as NodeJS.ProcessEnv).enabled).toBe(false);
        expect(getAlertConfig({ OPS_ALERTS_ENABLED: 'true', OPS_ALERT_EMAIL: 'not-an-address' } as unknown as NodeJS.ProcessEnv).enabled).toBe(false);
        expect(getAlertConfig({ OPS_ALERT_EMAIL: 'owner@example.com' } as unknown as NodeJS.ProcessEnv).enabled).toBe(false);
        expect(getAlertConfig({ OPS_ALERTS_ENABLED: 'true', OPS_ALERT_EMAIL: 'owner@example.com' } as unknown as NodeJS.ProcessEnv))
            .toMatchObject({ enabled: true, pdfFailureThreshold: 3, pdfWindowMinutes: 15, jobOverdueHours: 26 });
    });

    it('applies thresholds and never fires for unobserved or in-grace jobs', () => {
        const job = (health: 'not_observed' | 'within_grace' | 'overdue' | 'failed' | 'partial') => ({
            jobName: 'activation_reconcile' as const, health, lastStartedAt: null, lastStatus: null, lastDurationMs: null, lastSuccessAt: null, firstObservedAt: null,
        });
        const firing = (snapshot: Parameters<typeof evaluateAlertConditions>[0]) =>
            evaluateAlertConditions(snapshot, config).filter((condition) => condition.firing).map((condition) => condition.key);
        const quiet = { pdfFailuresInWindow: 0, unrecoveredBillingFailures24h: 0, emailDeliveryFailures24h: 0, jobs: [] };

        expect(firing({ ...quiet, pdfFailuresInWindow: 2 })).toEqual([]);
        expect(firing({ ...quiet, pdfFailuresInWindow: 3 })).toEqual(['pdf_failures']);
        expect(firing({ ...quiet, unrecoveredBillingFailures24h: 1, emailDeliveryFailures24h: 1 })).toEqual(['billing_webhook_failure', 'email_delivery_failure']);
        expect(firing({ ...quiet, jobs: [job('not_observed'), job('within_grace'), job('partial')] })).toEqual([]);
        expect(firing({ ...quiet, jobs: [job('overdue')] })).toEqual(['job_overdue:activation_reconcile']);
        expect(firing({ ...quiet, jobs: [job('failed')] })).toEqual(['job_failed:activation_reconcile']);
    });

    it('notifies once per episode, stays silent while unchanged, and sends one recovery', async () => {
        const notify = vi.fn().mockResolvedValue(true);
        const run = () => runAlertEvaluation({ db: exec, jobs: [], config, notify });

        await pdfFailure(); await pdfFailure();
        expect((await run()).planned).toEqual([]);
        await pdfFailure();
        expect(await run()).toMatchObject({ sent: 1, conditionsFiring: ['pdf_failures'] });
        await pdfFailure();
        expect(await run()).toMatchObject({ sent: 0, planned: [] });
        expect(notify).toHaveBeenCalledTimes(1);

        // Failures age out of the window: one recovery message, then silence.
        await db.exec(`UPDATE operational_events SET occurred_at = NOW() - INTERVAL '20 minutes'`);
        expect((await run()).planned).toEqual([expect.objectContaining({ key: 'pdf_failures', kind: 'recovered' })]);
        expect((await run()).planned).toEqual([]);
        expect(notify).toHaveBeenCalledTimes(2);

        // A new episode notifies again.
        await pdfFailure(); await pdfFailure(); await pdfFailure();
        expect((await run()).sent).toBe(1);
        expect(notify).toHaveBeenCalledTimes(3);
    });

    it('sends nothing and keeps no state while disabled, and retries a failed notification', async () => {
        await pdfFailure(); await pdfFailure(); await pdfFailure();
        const notify = vi.fn().mockResolvedValue(false);
        const disabled = await runAlertEvaluation({ db: exec, jobs: [], config: { ...config, enabled: false }, notify });
        expect(disabled).toMatchObject({ enabled: false, sent: 0, conditionsFiring: ['pdf_failures'] });
        expect(disabled.planned).toHaveLength(1);
        expect(notify).not.toHaveBeenCalled();

        expect(await runAlertEvaluation({ db: exec, jobs: [], config, notify })).toMatchObject({ sent: 0, failed: 1 });
        expect(await count('SELECT COUNT(*)::int AS n FROM ops_alert_state')).toBe(0);
        notify.mockResolvedValue(true);
        expect((await runAlertEvaluation({ db: exec, jobs: [], config, notify })).sent).toBe(1);
    });

    it('alert text carries counts and an Admin link only', () => {
        const message = buildAlertMessage({ key: 'pdf_failures', kind: 'firing', summary: '3 unexpected PDF generation failures in the last 15 minutes' });
        expect(message.text).toContain('/admin/operations');
        expect(message.text).not.toMatch(/@|\/s\/|token/i);
        expect(planAlertNotifications([{ key: 'x', firing: false, summary: '' }], new Map())).toEqual([]);
    });
});

describe('retention', () => {
    it('prunes only expired operational observations, never audit or reminder records', async () => {
        expect(getOpsRetentionDays(undefined)).toBe(90);
        expect(getOpsRetentionDays('1')).toBe(7);
        expect(getOpsRetentionDays('5000')).toBe(365);

        await recordOperationalEvent({ db: exec, category: 'pdf', code: 'generation_failed', outcome: 'failure' });
        await recordOperationalEvent({ db: exec, category: 'email', code: 'completion_send_failed', outcome: 'failure' });
        await finishJobRun(await startJobRun('activation_reconcile', exec), 'success', {}, exec);
        await db.exec(`
            UPDATE operational_events SET occurred_at = NOW() - INTERVAL '120 days' WHERE category = 'pdf';
            UPDATE job_runs SET started_at = NOW() - INTERVAL '120 days';
            UPDATE reminder_operations SET created_at = NOW() - INTERVAL '400 days';
            INSERT INTO admin_audit_logs (admin_id, action, created_at) VALUES ('${ADMIN}', 'role_changed', NOW() - INTERVAL '400 days');
        `);
        expect(await pruneOperationalObservations({ db: exec, retentionDays: 90 })).toEqual({ events: 1, jobRuns: 1 });
        expect(await count('SELECT COUNT(*)::int AS n FROM operational_events')).toBe(1);
        expect(await count('SELECT COUNT(*)::int AS n FROM admin_audit_logs')).toBe(1);
        expect(await count('SELECT COUNT(*)::int AS n FROM reminder_operations')).toBe(1);
    });
});

describe('triage', () => {
    const act = (action: 'acknowledge' | 'snooze' | 'resolve' | 'reopen', expectedVersion: number, extra: Partial<Parameters<typeof applyTriageAction>[0]> = {}) =>
        applyTriageAction({
            db: exec, actor, sourceKey: 'incident:pdf:generation_failed', kind: 'service', action, expectedVersion,
            snoozedUntil: null, note: null, reason: 'Investigated the renderer', ...extra,
        });

    it('derives the kind from the key on the server', () => {
        expect(triageKindForSourceKey('incident:pdf:generation_failed')).toBe('service');
        expect(triageKindForSourceKey(`reminder:${OP}`)).toBe('service');
        expect(triageKindForSourceKey(`request_inactive:${REQ}`)).toBe('follow_up');
        expect(triageKindForSourceKey('accounts:drop')).toBeNull();
    });

    it('audits every change and refuses a write based on a stale view', async () => {
        expect(await act('acknowledge', 0, { note: 'Looking into it' })).toEqual({ outcome: 'OK', version: 1 });
        // A second operator acting on the view from before that change is refused.
        expect(await act('resolve', 0, { actor: { ...actor, adminId: ADMIN_2 } })).toEqual({ outcome: 'STALE', version: null });
        expect(await act('resolve', 1, { actor: { ...actor, adminId: ADMIN_2 } })).toEqual({ outcome: 'OK', version: 2 });
        expect(await act('reopen', 1)).toEqual({ outcome: 'STALE', version: null });
        expect(await act('reopen', 5)).toEqual({ outcome: 'STALE', version: null });

        const record = (await getTriageRecords({ db: exec, sourceKeys: ['incident:pdf:generation_failed'] })).get('incident:pdf:generation_failed');
        expect(record).toMatchObject({ state: 'resolved', version: 2, note: 'Looking into it', updatedByEmail: 'admin2@example.com' });

        const audits = await queryRows(db, `SELECT admin_id, metadata FROM admin_audit_logs ORDER BY created_at`);
        expect(audits).toHaveLength(2);
        expect(audits[0].metadata).toMatchObject({
            sourceKey: 'incident:pdf:generation_failed', triageAction: 'acknowledge', state: 'acknowledged',
            noteChanged: true, reason: 'Investigated the renderer',
        });
        // The private note is not copied into audit evidence.
        expect(JSON.stringify(audits)).not.toContain('Looking into it');
    });

    it('rolls back when the audit insert fails and refuses a non-admin actor', async () => {
        await db.exec(`
            CREATE OR REPLACE FUNCTION test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN RAISE EXCEPTION 'forced audit failure'; END $$;
            CREATE TRIGGER test_fail_audit BEFORE INSERT ON admin_audit_logs FOR EACH ROW EXECUTE FUNCTION test_fail_audit();
        `);
        await expect(act('acknowledge', 0)).rejects.toThrow(/forced audit failure/);
        await db.exec(`DROP TRIGGER test_fail_audit ON admin_audit_logs`);
        expect(await count('SELECT COUNT(*)::int AS n FROM admin_triage_items')).toBe(0);

        expect(await act('acknowledge', 0, { actor: { ...actor, adminId: OWNER } })).toEqual({ outcome: 'ACTOR_NOT_ADMIN', version: null });
        expect(await count('SELECT COUNT(*)::int AS n FROM admin_triage_items')).toBe(0);
    });

    it('returns expired snoozes and recurrences to the queue, and keeps unchanged resolved items quiet', () => {
        const now = new Date('2026-10-05T12:00:00Z');
        const record = (state: 'snoozed' | 'resolved' | 'acknowledged', snoozedUntil: string | null = null) => ({
            sourceKey: 'k', state, snoozedUntil, note: null, version: 1, updatedByEmail: null, stateChangedAt: '2026-10-01T00:00:00Z',
        });
        expect(effectiveTriageState(null, { lastOccurredAt: null }, now)).toMatchObject({ state: 'open', returned: null });
        expect(effectiveTriageState(record('snoozed', '2026-10-06T00:00:00Z'), { lastOccurredAt: null }, now).state).toBe('snoozed');
        expect(effectiveTriageState(record('snoozed', '2026-10-05T11:59:00Z'), { lastOccurredAt: null }, now))
            .toMatchObject({ state: 'open', returned: 'snooze_expired' });
        // Same episode observed before it was resolved: stays resolved.
        expect(effectiveTriageState(record('resolved'), { lastOccurredAt: '2026-09-30T00:00:00Z' }, now)).toMatchObject({ state: 'resolved', returned: null });
        // A failure after resolution is a new episode.
        expect(effectiveTriageState(record('resolved'), { lastOccurredAt: '2026-10-03T00:00:00Z' }, now)).toMatchObject({ state: 'open', returned: 'recurred' });
        expect(effectiveTriageState(record('acknowledged'), { lastOccurredAt: '2026-10-03T00:00:00Z' }, now).state).toBe('acknowledged');
    });

    it('never changes raw backlog counts, request status or sends anything', async () => {
        const before = await getFollowUpCandidates(exec);
        expect(before.inactiveRequests).toMatchObject({ total: 1, items: [{ sourceKey: `request_inactive:${REQ}`, href: `/admin/requests/${REQ}` }] });
        expect(before.accountsNotStarted).toMatchObject({ total: 1, items: [{ sourceKey: `account_not_started:${IDLE}`, label: 'idle@example.com' }] });
        const requestBefore = await one('SELECT status, last_activity_at, updated_at FROM requests');

        await applyTriageAction({
            db: exec, actor, sourceKey: `request_inactive:${REQ}`, kind: 'follow_up', action: 'resolve', expectedVersion: 0,
            snoozedUntil: null, note: null, reason: 'Customer says the deal fell through',
        });
        await applyTriageAction({
            db: exec, actor, sourceKey: `account_not_started:${IDLE}`, kind: 'follow_up', action: 'snooze', expectedVersion: 0,
            snoozedUntil: new Date(Date.now() + hours(48)), note: null, reason: 'Check back later',
        });

        const after = await getFollowUpCandidates(exec);
        expect(after.inactiveRequests.total).toBe(1);
        expect(after.accountsNotStarted.total).toBe(1);
        expect(await one('SELECT status, last_activity_at, updated_at FROM requests')).toEqual(requestBefore);
        expect(await count('SELECT COUNT(*)::int AS n FROM event_logs')).toBe(0);
        expect(await count(`SELECT COUNT(*)::int AS n FROM reminder_operations WHERE state = 'pending'`)).toBe(0);
    });
});
