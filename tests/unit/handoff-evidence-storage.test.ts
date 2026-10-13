// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSchemaDatabase, pgliteExecutor, queryRows } from '../helpers/pglite-db';

import type { StatementExecutor } from '@/lib/neon/statements';
import { applyEmailDeliveryEvent } from '@/lib/ops/email-delivery';
import { getIncidentSummary } from '@/lib/ops/overview';
import {
    applyNotificationDeliveryEvent,
    getHandoffEvidenceSummary,
    getRequestHandoffEvidence,
    insertHandoffEvidence,
    loadHandoffEvidenceSummary,
    recordHandoffEvidence,
} from '@/lib/neon/queries/handoff-evidence';
import {
    NOTIFICATION_OBSERVATION_MAX_PER_REQUEST,
    PDF_OBSERVATION_MAX_PER_REQUEST,
    buildNotificationEvidence,
    pdfObservationFromEvidence,
    type HandoffEvidence,
    type PdfRenderEvidence,
    type SettledSend,
} from '@/lib/telemetry/handoff-evidence';

// Real schema.sql (which mirrors migrations-handoff-evidence.sql) in disposable embedded PostgreSQL.
const OWNER = '00000000-0000-4000-8000-0000000000b1';
const REQ = '00000000-0000-4000-8000-0000000000d1';
const TEST_REQ = '00000000-0000-4000-8000-0000000000d2';
const REMINDER_OP = '00000000-0000-4000-8000-0000000000e1';
const op = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

let db: PGlite;
let exec: StatementExecutor;
const rows = (text: string, params: unknown[] = []) => queryRows(db, text, params);
const count = async (text: string) => Number((await rows(text))[0].n);

const rendered: PdfRenderEvidence = {
    requestId: REQ, isDemo: false, packetMode: 'simple', renderStrategy: 'print_pdf', launchStrategy: 'default',
    outcome: 'rendered', skipReason: null, failureStage: null, errorName: null,
    totalMs: 4000, dataMs: 50, launchMs: 900, renderMs: 3000, bytes: 40960,
};
const accepted = (messageId: string, extra: Record<string, unknown> = {}): SettledSend =>
    ({ status: 'fulfilled', value: { success: true, messageId, ...extra } });
const refused = (errorCode: string): SettledSend => ({ status: 'fulfilled', value: { success: false, error: 'x', errorCode } });
const completion = (operation: number, sends: SettledSend[], overrides: Record<string, unknown> = {}): HandoffEvidence =>
    buildNotificationEvidence({ operationId: op(operation), requestId: REQ, purpose: 'completion_notification', mode: 'live', sends, ...overrides });
const download = (evidence: Partial<PdfRenderEvidence>, httpStatus: number): HandoffEvidence =>
    ({ notifications: [], pdfRenders: [pdfObservationFromEvidence({ ...rendered, ...evidence }, { surface: 'download', httpStatus })!] });

beforeAll(async () => {
    db = await createSchemaDatabase();
    exec = pgliteExecutor(db);
}, 60000);
afterAll(async () => { await db?.close(); });

beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await db.exec(`
        TRUNCATE notification_observations, pdf_render_observations, operational_events, reminder_operations, requests, accounts CASCADE;
        INSERT INTO accounts (id, email, role, created_at) VALUES ('${OWNER}', 'owner@example.com', 'user', NOW());
        INSERT INTO requests (id, account_id, property_address, seller_email, status, public_token, seller_token, is_demo) VALUES
            ('${REQ}', '${OWNER}', '12 Private Rd', 'sam@example.com', 'submitted', 'pub1', 'sel1', false),
            ('${TEST_REQ}', '${OWNER}', '1 Demo St', 'owner@example.com', 'submitted', 'pub2', 'sel2', true);
        INSERT INTO reminder_operations (id, request_id, actor_type, recipient_email, payload_fingerprint, state, provider_message_id, accepted_at)
            VALUES ('${REMINDER_OP}', '${REQ}', 'agent', 'sam@example.com', '${'a'.repeat(64)}', 'accepted', 'msg_reminder', NOW());
    `);
});

describe('schema mirror', () => {
    it('applies the migration idempotently on top of schema.sql and alone', async () => {
        const migration = readFileSync('migrations-handoff-evidence.sql', 'utf8');
        await db.exec(migration);
        await db.exec(migration);

        const fresh = new PGlite();
        await fresh.exec(`CREATE TABLE requests (id UUID PRIMARY KEY);`);
        await fresh.exec(migration);
        const columns = (source: PGlite) => source.query<{ c: string }>(`
            SELECT table_name || '.' || column_name || ':' || data_type || ':' || is_nullable AS c
            FROM information_schema.columns
            WHERE table_name IN ('notification_observations', 'pdf_render_observations') ORDER BY 1`);
        expect((await columns(fresh)).rows).toEqual((await columns(db)).rows);
        expect((await columns(fresh)).rows.length).toBeGreaterThan(30);
        await fresh.close();
    });

    it('has no column that could hold an address, name, link or filename', async () => {
        const names = (await rows(`SELECT column_name FROM information_schema.columns
            WHERE table_name IN ('notification_observations', 'pdf_render_observations')`)).map((row) => String(row.column_name));
        expect(names.filter((name) => /email|address|name$|token|url|file|html|subject|(^|_)ip(_|$)|user_agent/.test(name) && name !== 'error_name')).toEqual([]);
    });
});

describe('insertHandoffEvidence', () => {
    it('stores per-recipient outcomes and the PDF render for each slot in one statement', async () => {
        const stored = await insertHandoffEvidence(completion(1, [
            accepted('msg_a', { attachmentStatus: 'attached', pdfEvidence: rendered }),
            refused('rate_limit_exceeded'),
            { status: 'rejected' },
        ]), { db: exec });
        expect(stored).toEqual({ notifications: 3, pdfRenders: 1 });

        expect(await rows(`SELECT recipient_slot, intended_recipients, send_outcome, provider_message_id, failure_code, attachment_status, delivery_status
            FROM notification_observations ORDER BY recipient_slot`)).toEqual([
            { recipient_slot: 0, intended_recipients: 3, send_outcome: 'accepted', provider_message_id: 'msg_a', failure_code: null, attachment_status: 'attached', delivery_status: null },
            { recipient_slot: 1, intended_recipients: 3, send_outcome: 'failed', provider_message_id: null, failure_code: 'rate_limit_exceeded', attachment_status: 'not_applicable', delivery_status: null },
            { recipient_slot: 2, intended_recipients: 3, send_outcome: 'unknown', provider_message_id: null, failure_code: 'threw', attachment_status: 'not_applicable', delivery_status: null },
        ]);
        expect(await rows(`SELECT surface, mode, outcome, operation_id::text AS operation_id, recipient_slot, total_ms, bytes, http_status FROM pdf_render_observations`)).toEqual([
            { surface: 'completion_attachment', mode: 'live', outcome: 'rendered', operation_id: op(1), recipient_slot: 0, total_ms: 4000, bytes: 40960, http_status: null },
        ]);
    });

    it('stores a repeated operation slot once', async () => {
        const evidence = completion(1, [accepted('msg_a')]);
        expect((await insertHandoffEvidence(evidence, { db: exec })).notifications).toBe(1);
        expect((await insertHandoffEvidence(evidence, { db: exec })).notifications).toBe(0);
        expect(await count(`SELECT COUNT(*)::int AS n FROM notification_observations`)).toBe(1);
    });

    it('stops storing at the per-request ceilings without failing', async () => {
        await db.exec(`
            INSERT INTO notification_observations (operation_id, request_id, purpose, mode, recipient_slot, intended_recipients, send_outcome)
                SELECT gen_random_uuid(), '${REQ}', 'completion_notification', 'live', 0, 1, 'accepted' FROM generate_series(1, ${NOTIFICATION_OBSERVATION_MAX_PER_REQUEST - 1});
            INSERT INTO pdf_render_observations (request_id, surface, mode, outcome)
                SELECT '${REQ}', 'download', 'live', 'rendered' FROM generate_series(1, ${PDF_OBSERVATION_MAX_PER_REQUEST});
        `);
        // Two more notification rows would pass the ceiling: neither is stored. PDF evidence is already full.
        expect(await insertHandoffEvidence(completion(1, [accepted('a'), accepted('b')]), { db: exec })).toEqual({ notifications: 0, pdfRenders: 0 });
        expect(await insertHandoffEvidence(completion(2, [accepted('a')]), { db: exec })).toEqual({ notifications: 1, pdfRenders: 0 });
        expect(await insertHandoffEvidence(download({}, 200), { db: exec })).toEqual({ notifications: 0, pdfRenders: 0 });
        // Another request is unaffected.
        expect(await insertHandoffEvidence(download({ requestId: TEST_REQ, isDemo: true }, 200), { db: exec })).toEqual({ notifications: 0, pdfRenders: 1 });
    });

    it('is removed with its request', async () => {
        await insertHandoffEvidence(completion(1, [accepted('msg_a', { attachmentStatus: 'attached', pdfEvidence: rendered })]), { db: exec });
        await db.exec(`DELETE FROM requests WHERE id = '${REQ}'`);
        expect(await count(`SELECT COUNT(*)::int AS n FROM notification_observations`)).toBe(0);
        expect(await count(`SELECT COUNT(*)::int AS n FROM pdf_render_observations`)).toBe(0);
    });
});

describe('recordHandoffEvidence', () => {
    it('reports failure instead of throwing when the store rejects or stalls', async () => {
        const evidence = completion(1, [accepted('msg_a')]);
        const rejecting: StatementExecutor = { run: async () => { throw new Error('connect ECONNREFUSED 10.0.0.1'); }, transaction: async () => [] };
        await expect(recordHandoffEvidence(evidence, { db: rejecting })).resolves.toBe(false);

        const stalled: StatementExecutor = { run: () => new Promise(() => undefined), transaction: async () => [] };
        const startedAt = Date.now();
        await expect(recordHandoffEvidence(evidence, { db: stalled })).resolves.toBe(false);
        expect(Date.now() - startedAt).toBeLessThan(2000);

        // The accepted message is unaffected; only its evidence is missing, and the log line is redacted.
        expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toMatch(/ECONNREFUSED|10\.0\.0\.1|msg_a/);
        expect(vi.mocked(console.warn)).toHaveBeenCalledWith('[diagnostic] auxiliary_write_failed', expect.objectContaining({ observation: 'handoff_evidence' }));
    });

    it('writes nothing and reports false for empty evidence', async () => {
        const run = vi.fn();
        await expect(recordHandoffEvidence({ notifications: [], pdfRenders: [] }, { db: { run, transaction: vi.fn() } })).resolves.toBe(false);
        expect(run).not.toHaveBeenCalled();
    });

    it('stores through the same path when the database is available', async () => {
        await expect(recordHandoffEvidence(completion(1, []), { db: exec })).resolves.toBe(true);
        expect(await rows(`SELECT send_outcome, intended_recipients FROM notification_observations`)).toEqual([{ send_outcome: 'no_recipients', intended_recipients: 0 }]);
    });
});

describe('applyNotificationDeliveryEvent', () => {
    const apply = (providerMessageId: string, status: Parameters<typeof applyNotificationDeliveryEvent>[0]['status'], webhookMessageId: string) =>
        applyNotificationDeliveryEvent({ db: exec, providerMessageId, status, webhookMessageId });
    const deliveryOf = async (messageId: string) =>
        (await rows(`SELECT delivery_status FROM notification_observations WHERE provider_message_id = $1`, [messageId]))[0]?.delivery_status;

    beforeEach(async () => {
        await insertHandoffEvidence(completion(1, [accepted('msg_a'), accepted('msg_b')]), { db: exec });
        await insertHandoffEvidence(buildNotificationEvidence({
            operationId: op(2), requestId: REQ, purpose: 'request_invitation', mode: 'live', sends: [accepted('msg_invite')],
        }), { db: exec });
        await insertHandoffEvidence(buildNotificationEvidence({
            operationId: op(3), requestId: TEST_REQ, purpose: 'completion_notification', mode: 'test', sends: [accepted('msg_test')],
        }), { db: exec });
    });

    it('confirms delivery for the matching recipient slot only', async () => {
        expect(await apply('msg_a', 'delivered', 'wh_1')).toEqual({ matched: true });
        expect(await deliveryOf('msg_a')).toBe('delivered');
        expect(await deliveryOf('msg_b')).toBeNull();
        // Delivery is not an incident.
        expect(await count(`SELECT COUNT(*)::int AS n FROM operational_events`)).toBe(0);
    });

    it('never lets a late or out-of-order event erase a more significant one', async () => {
        await apply('msg_a', 'bounced', 'wh_bounce');
        await apply('msg_a', 'delivered', 'wh_delivered');
        await apply('msg_a', 'delayed', 'wh_delayed');
        expect(await deliveryOf('msg_a')).toBe('bounced');
        await apply('msg_a', 'complained', 'wh_complaint');
        expect(await deliveryOf('msg_a')).toBe('complained');
    });

    it('counts a redelivered callback once and links the incident to the request', async () => {
        await apply('msg_a', 'bounced', 'wh_bounce');
        await apply('msg_a', 'bounced', 'wh_bounce');
        await apply('msg_invite', 'failed', 'wh_invite');
        const events = await rows(`SELECT code, outcome, severity, fingerprint, request_id::text AS request_id, attempts, metadata
            FROM operational_events ORDER BY code`);
        expect(events).toEqual([
            { code: 'completion_bounced', outcome: 'failure', severity: 'warning', fingerprint: 'email:completion_bounced', request_id: REQ, attempts: 2, metadata: { deliveryStatus: 'bounced', operationId: op(1) } },
            { code: 'invitation_undelivered', outcome: 'failure', severity: 'warning', fingerprint: 'email:invitation_undelivered', request_id: REQ, attempts: 1, metadata: { deliveryStatus: 'failed', operationId: op(2) } },
        ]);
        // The existing Operations incident reader groups it and points at the request.
        const summary = await getIncidentSummary(exec);
        expect(summary.incidents.find((incident) => incident.fingerprint === 'email:completion_bounced')).toMatchObject({ occurrences: 1, latestRequestId: REQ });
    });

    it('marks a complaint critical and keeps seller test sends out of incidents', async () => {
        await apply('msg_b', 'complained', 'wh_c');
        await apply('msg_test', 'bounced', 'wh_t');
        expect(await rows(`SELECT code, severity FROM operational_events`)).toEqual([{ code: 'completion_complained', severity: 'critical' }]);
        expect(await deliveryOf('msg_test')).toBe('bounced');
    });

    it('stores nothing for a verified event about an unknown message', async () => {
        expect(await apply('msg_never_recorded', 'bounced', 'wh_x')).toEqual({ matched: false });
        expect(await count(`SELECT COUNT(*)::int AS n FROM operational_events`)).toBe(0);
        expect(await count(`SELECT COUNT(*)::int AS n FROM notification_observations WHERE delivery_status IS NOT NULL`)).toBe(0);
    });

    it('leaves reminders to their own contract in both directions', async () => {
        // A reminder message is not notification evidence.
        expect(await apply('msg_reminder', 'delivered', 'wh_r')).toEqual({ matched: false });
        expect((await rows(`SELECT delivery_status FROM reminder_operations WHERE id = '${REMINDER_OP}'`))[0].delivery_status).toBeNull();
        // A notification message is not a reminder, and the reminder path still works unchanged.
        expect(await applyEmailDeliveryEvent({ db: exec, providerMessageId: 'msg_a', status: 'bounced', webhookMessageId: 'wh_n' })).toEqual({ matched: false });
        expect(await applyEmailDeliveryEvent({ db: exec, providerMessageId: 'msg_reminder', status: 'bounced', webhookMessageId: 'wh_rb' })).toEqual({ matched: true });
        expect(await rows(`SELECT code, metadata->>'operationId' AS operation FROM operational_events`)).toEqual([{ code: 'reminder_bounced', operation: REMINDER_OP }]);
        expect(await deliveryOf('msg_a')).toBeNull();
    });
});

describe('read model', () => {
    beforeEach(async () => {
        await insertHandoffEvidence(completion(1, [
            accepted('msg_a', { attachmentStatus: 'attached', pdfEvidence: rendered }),
            refused('validation_error'),
        ]), { db: exec });
        await insertHandoffEvidence(completion(2, [accepted('msg_c', { attachmentStatus: 'failed', pdfEvidence: { ...rendered, outcome: 'failed', failureStage: 'browser_launch', errorName: 'Error', bytes: null } })]), { db: exec });
        await insertHandoffEvidence(completion(3, []), { db: exec });
        await insertHandoffEvidence(buildNotificationEvidence({ operationId: op(4), requestId: REQ, purpose: 'request_invitation', mode: 'live', sends: [{ status: 'rejected' }] }), { db: exec });
        await insertHandoffEvidence(buildNotificationEvidence({ operationId: op(5), requestId: TEST_REQ, purpose: 'completion_notification', mode: 'test', sends: [accepted('msg_test')] }), { db: exec });
        await insertHandoffEvidence(download({ totalMs: 2000, bytes: 20480 }, 200), { db: exec });
        await insertHandoffEvidence(download({ totalMs: 6000, bytes: 61440 }, 200), { db: exec });
        await insertHandoffEvidence(download({ outcome: 'skipped', skipReason: 'locked', bytes: null }, 402), { db: exec });
        await insertHandoffEvidence(download({ outcome: 'failed', failureStage: 'render', errorName: 'TimeoutError', bytes: null }, 500), { db: exec });
        await applyNotificationDeliveryEvent({ db: exec, providerMessageId: 'msg_a', status: 'delivered', webhookMessageId: 'wh_1' });
    });

    it('separates accepted, failed, unknown, partial, no-recipient and delivery facts for live requests', async () => {
        const summary = await getHandoffEvidenceSummary(exec);
        expect(summary.notifications.completion_notification).toEqual({
            operations: 3, noRecipients: 1, partialOperations: 1, attempted: 3, accepted: 2, failed: 1, unknown: 0,
            delivered: 1, delayed: 0, bounced: 0, complained: 0, deliveryFailed: 0, deliveryUnknown: 1,
            attachmentAttached: 1, attachmentFailed: 1, attachmentSkipped: 0,
        });
        expect(summary.notifications.request_invitation).toMatchObject({ operations: 1, attempted: 1, accepted: 0, failed: 0, unknown: 1, deliveryUnknown: 0 });
        expect(summary.testOperations).toBe(1);
        expect(summary.firstObservationAt).not.toBeNull();
    });

    it('separates PDF outcomes by surface and failed stage, with duration and size of successful renders only', async () => {
        const { pdf } = await getHandoffEvidenceSummary(exec);
        expect(pdf.download).toMatchObject({ rendered: 2, failed: 1, skipped: 1, medianMs: 4000, medianBytes: 40960 });
        expect(pdf.download.failedByStage).toEqual({ data: 0, build_html: 0, browser_launch: 0, page_load: 0, render: 1 });
        expect(pdf.download.p95Ms).toBeGreaterThan(5000);
        expect(pdf.completion_attachment).toMatchObject({ rendered: 1, failed: 1, skipped: 0 });
        expect(pdf.completion_attachment.failedByStage.browser_launch).toBe(1);
    });

    it('reports empty evidence as empty, with no first observation', async () => {
        await db.exec(`TRUNCATE notification_observations, pdf_render_observations`);
        const summary = await getHandoffEvidenceSummary(exec);
        expect(summary.firstObservationAt).toBeNull();
        expect(summary.notifications.completion_notification.operations).toBe(0);
        expect(summary.pdf.download).toMatchObject({ rendered: 0, medianMs: null, p95Ms: null });
    });

    it('lists one request\'s evidence without provider message ids', async () => {
        const evidence = await getRequestHandoffEvidence({ db: exec, requestId: REQ });
        expect(evidence.notifications).toHaveLength(5);
        expect(evidence.notifications.find((row) => row.deliveryStatus === 'delivered')).toMatchObject({ purpose: 'completion_notification', recipientSlot: 0, intendedRecipients: 2, attachmentStatus: 'attached' });
        expect(evidence.pdfRenders).toHaveLength(6);
        expect(JSON.stringify(evidence)).not.toMatch(/msg_/);
        expect((await getRequestHandoffEvidence({ db: exec, requestId: TEST_REQ })).notifications).toEqual([expect.objectContaining({ mode: 'test' })]);
    });

    it('reports a pending migration and a failed read as states, never as zero', async () => {
        const missing: StatementExecutor = { run: async () => { throw Object.assign(new Error('relation does not exist'), { code: '42P01' }); }, transaction: async () => [] };
        expect(await loadHandoffEvidenceSummary({ db: missing })).toEqual({ status: 'not_installed' });
        const broken: StatementExecutor = { run: async () => { throw new Error('timeout'); }, transaction: async () => [] };
        expect(await loadHandoffEvidenceSummary({ db: broken })).toEqual({ status: 'error' });
        expect((await loadHandoffEvidenceSummary({ db: exec })).status).toBe('ok');
    });
});
