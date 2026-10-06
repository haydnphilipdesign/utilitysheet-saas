// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSchemaDatabase, pgliteExecutor, queryRows } from '../helpers/pglite-db';

vi.mock('@/lib/pdf/packet-attachment', () => ({ createPacketPdfAttachmentForRequest: vi.fn() }));
vi.mock('@/lib/neon/queries', () => ({ getBrandProfile: vi.fn(), getRequestById: vi.fn() }));

import type { StatementExecutor } from '@/lib/neon/statements';
import type { AdminActor } from '@/lib/neon/queries/admin-writes';
import {
    finalizeReminderAccepted,
    getReminderHistory,
    resolveReminderNotSent,
    type ReminderActor,
} from '@/lib/neon/queries/reminder-operations';
import {
    buildReminderForRequest,
    classifyProviderResult,
    executeSellerReminder,
    prepareSellerReminder,
    type PreparedSellerReminder,
} from '@/lib/reminders/seller-reminder';
import { getRequestById } from '@/lib/neon/queries';
import type { Request } from '@/types';

// Real schema.sql plus the reminder migration in disposable embedded PostgreSQL.
const ADMIN = '00000000-0000-4000-8000-0000000000a1';
const OWNER = '00000000-0000-4000-8000-0000000000b1';
const REQ = '00000000-0000-4000-8000-0000000000d1';
const SUBMITTED = '00000000-0000-4000-8000-0000000000d2';
const op = (n: number) => `00000000-0000-4000-8000-00000000e${String(n).padStart(3, '0')}`;

let db: PGlite;
let exec: StatementExecutor;
const admin: AdminActor = { adminId: ADMIN, ipAddress: '203.0.113.9', userAgent: 'vitest' };
const adminActor: ReminderActor = { type: 'admin', admin, reason: 'Seller asked for the link again' };
const agentActor: ReminderActor = { type: 'agent', accountId: OWNER, ipAddress: null, userAgent: null };

const one = async (text: string, params: unknown[] = []) => (await queryRows(db, text, params))[0];
const count = async (text: string) => Number((await one(text)).n);
const events = () => count("SELECT COUNT(*)::int AS n FROM event_logs WHERE event_type = 'reminder_sent'");
const audits = (action: string) => count(`SELECT COUNT(*)::int AS n FROM admin_audit_logs WHERE action = '${action}'`);
const state = async (id: string) => (await one('SELECT state FROM reminder_operations WHERE id = $1', [id]))?.state;

function prepared(id = REQ, overrides: Partial<Request> = {}): PreparedSellerReminder {
    const request = {
        id, account_id: OWNER, property_address: '1 Open St', seller_name: 'Sam Seller',
        seller_email: 'sam@example.com', seller_token: 'secret-seller-token', public_token: 'pub1',
        status: 'sent', brand_profile_id: null, ...overrides,
    } as unknown as Request;
    return { request, ...buildReminderForRequest(request, null, 'Olivia Owner') };
}

const accepted = (id = 'msg_1') => vi.fn().mockResolvedValue({ success: true, messageId: id });
const run = (operationId: string, actor: ReminderActor, send: ReturnType<typeof vi.fn>, p = prepared()) =>
    executeSellerReminder({ db: exec, operationId, actor, prepared: p, send: send as never });

beforeAll(async () => {
    db = await createSchemaDatabase(['migrations-reminder-operations.sql']);
    exec = pgliteExecutor(db);
}, 60000);
afterAll(async () => { await db?.close(); });

beforeEach(async () => {
    await db.exec(`
        TRUNCATE reminder_operations, admin_audit_logs, event_logs, requests, accounts CASCADE;
        INSERT INTO accounts (id, email, role, full_name) VALUES
            ('${ADMIN}', 'admin@example.com', 'admin', 'Admin'), ('${OWNER}', 'owner@example.com', 'user', 'Olivia Owner');
        INSERT INTO requests (id, account_id, property_address, seller_name, seller_email, status, public_token, seller_token, metered_at) VALUES
            ('${REQ}', '${OWNER}', '1 Open St', 'Sam Seller', 'sam@example.com', 'sent', 'pub1', 'secret-seller-token', NULL),
            ('${SUBMITTED}', '${OWNER}', '2 Done St', 'Sam Seller', 'sam@example.com', 'submitted', 'pub2', 'secret-seller-token-2', NOW());
    `);
});

describe('one logical reminder', () => {
    it('audits the attempt before sending, then records one event and one sent audit', async () => {
        const send = vi.fn(async () => {
            // The attempt is already durable while the provider is being called.
            expect(await state(op(1))).toBe('pending');
            expect(await audits('request_reminder_attempted')).toBe(1);
            return { success: true, messageId: 'msg_1' };
        });
        expect(await run(op(1), adminActor, send)).toEqual({ status: 'accepted', operationId: op(1), alreadyAccepted: false });
        expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: 'sam@example.com' }), { idempotencyKey: `seller-reminder/${op(1)}` });
        expect(await one('SELECT state, provider_message_id, actor_type FROM reminder_operations'))
            .toEqual({ state: 'accepted', provider_message_id: 'msg_1', actor_type: 'admin' });
        expect((await one("SELECT event_data FROM event_logs WHERE event_type = 'reminder_sent'")).event_data).toEqual({
            actor: 'admin', channel: 'email', operationId: op(1), adminId: ADMIN, reason: adminActor.type === 'admin' ? adminActor.reason : '',
        });
        expect(await audits('request_reminder_sent')).toBe(1);
    });

    it('keeps capability tokens and rendered bodies out of every durable record', async () => {
        const p = prepared();
        expect(p.email.html).toContain('secret-seller-token');
        await run(op(1), adminActor, accepted(), p);
        const stored = JSON.stringify([
            await queryRows(db, 'SELECT * FROM reminder_operations'),
            await queryRows(db, 'SELECT * FROM admin_audit_logs'),
            await queryRows(db, 'SELECT * FROM event_logs'),
        ]);
        expect(stored).not.toContain('secret-seller-token');
        expect(stored).not.toContain('<html');
    });

    it('blocks a second send during the cooldown from either path, with no second provider call', async () => {
        await run(op(1), adminActor, accepted());
        const send = accepted('msg_2');
        const second = await run(op(2), agentActor, send);
        expect(second).toMatchObject({ status: 'blocked', code: 'COOLDOWN' });
        expect((second as { retryAfterSeconds: number }).retryAfterSeconds).toBeGreaterThan(590);
        expect(await run(op(3), adminActor, send)).toMatchObject({ status: 'blocked', code: 'COOLDOWN' });
        expect(send).not.toHaveBeenCalled();
        expect(await events()).toBe(1);
    });

    it('honours the cooldown against reminders recorded before this table existed', async () => {
        await db.exec(`INSERT INTO event_logs (request_id, event_type) VALUES ('${REQ}', 'reminder_sent')`);
        expect(await run(op(1), agentActor, accepted())).toMatchObject({ status: 'blocked', code: 'COOLDOWN' });
        await db.exec(`UPDATE event_logs SET created_at = NOW() - INTERVAL '11 minutes'`);
        expect((await run(op(1), agentActor, accepted())).status).toBe('accepted');
        expect((await one("SELECT event_data FROM event_logs ORDER BY created_at DESC LIMIT 1")).event_data)
            .toEqual({ actor: 'agent', channel: 'email', operationId: op(1) });
        expect(await count('SELECT COUNT(*)::int AS n FROM admin_audit_logs')).toBe(0);
    });

    it('lets only one of two overlapping operations claim (Admin and customer)', async () => {
        let release!: () => void;
        const gate = new Promise<void>((resolve) => { release = resolve; });
        const slow = vi.fn(async () => { await gate; return { success: true, messageId: 'msg_1' }; });
        const first = run(op(1), adminActor, slow);
        await vi.waitFor(async () => expect(await state(op(1))).toBe('pending'));

        const other = accepted('msg_2');
        expect(await run(op(2), agentActor, other)).toMatchObject({ status: 'blocked', code: 'IN_FLIGHT', blockingOperationId: op(1) });
        // A double click resubmits the same operation while it is still being sent.
        expect(await run(op(1), adminActor, other)).toMatchObject({ status: 'blocked', code: 'IN_FLIGHT' });
        expect(other).not.toHaveBeenCalled();

        release();
        expect((await first).status).toBe('accepted');
        expect(await events()).toBe(1);
    });

    it('enforces a single pending operation per request in the database itself', async () => {
        const insert = (id: string) => db.query(
            `INSERT INTO reminder_operations (id, request_id, actor_type, recipient_email, payload_fingerprint)
             VALUES ($1, $2, 'agent', 'sam@example.com', $3)`, [id, REQ, 'a'.repeat(64)]);
        await insert(op(1));
        await expect(insert(op(2))).rejects.toMatchObject({ code: '23505' });
    });
});

describe('recoverable outcomes', () => {
    it('provider accepts, the record fails: retry reuses the key and never duplicates the event or audit', async () => {
        const send = accepted('msg_1');
        await db.exec(`
            CREATE OR REPLACE FUNCTION test_fail_event() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN RAISE EXCEPTION 'forced timeline failure'; END $$;
            CREATE TRIGGER test_fail_event BEFORE INSERT ON event_logs FOR EACH ROW EXECUTE FUNCTION test_fail_event();
        `);
        expect(await run(op(1), adminActor, send)).toEqual({ status: 'accepted_unrecorded', operationId: op(1) });
        expect(await state(op(1))).toBe('pending');
        // No ordinary fresh send is possible while the accepted message is unrecorded.
        expect(await run(op(2), adminActor, send)).toMatchObject({ status: 'blocked', code: 'IN_FLIGHT' });
        await db.exec(`DROP TRIGGER test_fail_event ON event_logs`);
        await db.exec(`UPDATE reminder_operations SET updated_at = NOW() - INTERVAL '2 minutes'`);

        expect(await run(op(1), adminActor, send)).toEqual({ status: 'accepted', operationId: op(1), alreadyAccepted: false });
        expect(send).toHaveBeenCalledTimes(2);
        expect(send.mock.calls.map((call) => call[1])).toEqual([
            { idempotencyKey: `seller-reminder/${op(1)}` }, { idempotencyKey: `seller-reminder/${op(1)}` },
        ]);
        expect(await events()).toBe(1);
        expect(await audits('request_reminder_sent')).toBe(1);

        // Repeating a completed operation sends nothing and records nothing.
        expect(await run(op(1), adminActor, send)).toEqual({ status: 'accepted', operationId: op(1), alreadyAccepted: true });
        expect(send).toHaveBeenCalledTimes(2);
        expect(await events()).toBe(1);
    });

    it('a definitive rejection is recorded as not sent and does not start a cooldown', async () => {
        const rejected = vi.fn().mockResolvedValue({ success: false, error: 'bad address', errorCode: 'validation_error' });
        expect(await run(op(1), adminActor, rejected)).toEqual({ status: 'failed', operationId: op(1), code: 'validation_error' });
        expect(await events()).toBe(0);
        // The failed operation cannot be reused; a new reviewed operation can proceed.
        expect(await run(op(1), adminActor, accepted())).toMatchObject({ status: 'blocked', code: 'OPERATION_FAILED' });
        expect((await run(op(2), adminActor, accepted())).status).toBe('accepted');
    });

    it('a timeout is unknown: it blocks fresh sends but the same operation can be retried', async () => {
        const timeout = vi.fn().mockResolvedValue({ success: false, error: 'fetch failed', threw: true });
        expect(await run(op(1), adminActor, timeout)).toEqual({ status: 'unknown', operationId: op(1), code: 'provider_request_failed' });
        expect(await run(op(2), agentActor, accepted())).toMatchObject({ status: 'blocked', code: 'UNRESOLVED', blockingOperationId: op(1) });
        const retry = accepted('msg_1');
        expect((await run(op(1), adminActor, retry)).status).toBe('accepted');
        expect(retry).toHaveBeenCalledWith(expect.anything(), { idempotencyKey: `seller-reminder/${op(1)}` });
        expect(await events()).toBe(1);
    });

    it('refuses to retry once the provider idempotency window has passed, or when the payload changed', async () => {
        const timeout = vi.fn().mockResolvedValue({ success: false, error: 'fetch failed', threw: true });
        await run(op(1), adminActor, timeout);

        const changed = accepted();
        expect(await run(op(1), adminActor, changed, prepared(REQ, { seller_name: 'Different Name' })))
            .toMatchObject({ status: 'blocked', code: 'PAYLOAD_CHANGED' });

        await db.exec(`UPDATE reminder_operations SET created_at = NOW() - INTERVAL '23 hours 30 minutes'`);
        expect(await run(op(1), adminActor, changed)).toMatchObject({ status: 'blocked', code: 'RETRY_WINDOW_EXPIRED' });
        expect(await run(op(2), adminActor, changed)).toMatchObject({ status: 'blocked', code: 'UNRESOLVED' });
        expect(changed).not.toHaveBeenCalled();

        // After the window nothing can deduplicate it any more; it stops blocking new reviewed sends.
        await db.exec(`UPDATE reminder_operations SET created_at = NOW() - INTERVAL '25 hours'`);
        expect((await run(op(2), adminActor, accepted())).status).toBe('accepted');
    });

    it('treats an abandoned claim as unknown rather than silently allowing a new send', async () => {
        await db.query(
            `INSERT INTO reminder_operations (id, request_id, actor_type, recipient_email, payload_fingerprint, updated_at)
             VALUES ($1, $2, 'agent', 'sam@example.com', $3, NOW() - INTERVAL '20 minutes')`, [op(1), REQ, prepared().fingerprint]);
        expect(await run(op(2), agentActor, accepted())).toMatchObject({ status: 'blocked', code: 'UNRESOLVED', blockingOperationId: op(1) });
        expect(await one('SELECT state, failure_code FROM reminder_operations WHERE id = $1', [op(1)]))
            .toEqual({ state: 'unknown', failure_code: 'abandoned_claim' });
    });

    it('lets an operator settle an unknown outcome either way, audited, without duplicating the event', async () => {
        const timeout = vi.fn().mockResolvedValue({ success: false, error: 'fetch failed', threw: true });
        await run(op(1), adminActor, timeout);
        expect(await resolveReminderNotSent({ db: exec, operationId: op(1), admin, reason: 'Checked provider: no message' }))
            .toEqual({ resolved: true });
        expect(await resolveReminderNotSent({ db: exec, operationId: op(1), admin, reason: 'again' })).toEqual({ resolved: false });
        expect(await audits('request_reminder_resolved')).toBe(1);
        expect(await events()).toBe(0);

        await run(op(2), adminActor, timeout);
        const settle = () => finalizeReminderAccepted({
            db: exec, operationId: op(2), providerMessageId: null, admin, auditAction: 'request_reminder_resolved',
            auditReason: 'Provider shows it delivered', verifiedManually: true, ipAddress: null, userAgent: null,
        });
        expect(await settle()).toEqual({ finalized: true });
        expect(await settle()).toEqual({ finalized: false });
        expect(await events()).toBe(1);
        expect((await one("SELECT event_data FROM event_logs WHERE event_type = 'reminder_sent'")).event_data)
            .toMatchObject({ verifiedManually: true, operationId: op(2) });
        const history = await getReminderHistory({ db: exec, requestId: REQ });
        expect(history.operations.map((o) => o.state)).toEqual(['accepted', 'failed']);
        expect(history.lastSentAt).not.toBeNull();
    });
});

describe('eligibility at execution', () => {
    it('applies Admin policy at the claim: submitted, deleted, changed recipient, ineligible owner, non-admin actor', async () => {
        const send = accepted();
        expect(await run(op(1), adminActor, send, prepared(SUBMITTED))).toMatchObject({ code: 'REQUEST_SUBMITTED' });
        expect(await run(op(2), adminActor, send, prepared(REQ, { seller_email: 'old@example.com' }))).toMatchObject({ code: 'RECIPIENT_CHANGED' });
        await db.exec(`UPDATE accounts SET role = 'banned' WHERE id = '${OWNER}'`);
        expect(await run(op(3), adminActor, send)).toMatchObject({ code: 'OWNER_INELIGIBLE' });
        await db.exec(`UPDATE accounts SET role = 'user' WHERE id = '${OWNER}'; UPDATE requests SET deleted_at = NOW() WHERE id = '${REQ}'`);
        expect(await run(op(4), adminActor, send)).toMatchObject({ code: 'REQUEST_DELETED' });
        await db.exec(`UPDATE requests SET deleted_at = NULL WHERE id = '${REQ}'; UPDATE accounts SET role = 'user' WHERE id = '${ADMIN}'`);
        expect(await run(op(5), adminActor, send)).toMatchObject({ code: 'ACTOR_NOT_ADMIN' });
        expect(await run(op(6), adminActor, send, prepared('00000000-0000-4000-8000-00000000ffff'))).toMatchObject({ code: 'NOT_FOUND' });
        expect(send).not.toHaveBeenCalled();
        expect(await count('SELECT COUNT(*)::int AS n FROM reminder_operations')).toBe(0);
        expect(await count('SELECT COUNT(*)::int AS n FROM admin_audit_logs')).toBe(0);
    });

    it('lets Admin remind a request a coordinator reopened, but no other request with a recorded submission', async () => {
        // Reopened: in progress again, first submission still recorded, editing session advanced.
        await db.exec(`UPDATE requests SET status = 'in_progress', seller_edit_version = 1 WHERE id = '${SUBMITTED}'`);
        const send = accepted();
        expect(await run(op(1), adminActor, send, prepared(SUBMITTED))).toMatchObject({ status: 'accepted' });
        expect(send).toHaveBeenCalledTimes(1);
        expect(await events()).toBe(1);
        expect(await audits('request_reminder_sent')).toBe(1);

        // In progress with a recorded submission but never reopened (a status correction): still refused.
        await db.exec(`TRUNCATE reminder_operations, event_logs; UPDATE requests SET seller_edit_version = 0 WHERE id = '${SUBMITTED}'`);
        expect(await run(op(2), adminActor, send, prepared(SUBMITTED))).toMatchObject({ code: 'REQUEST_SUBMITTED' });

        // Closed without changes or resubmitted: submitted again, so refused whatever the session number.
        await db.exec(`UPDATE requests SET status = 'submitted', seller_edit_version = 2 WHERE id = '${SUBMITTED}'`);
        expect(await run(op(3), adminActor, send, prepared(SUBMITTED))).toMatchObject({ code: 'REQUEST_SUBMITTED' });
        expect(send).toHaveBeenCalledTimes(1);
    });

    it('applies the same reopened rule when the Admin preview is prepared', async () => {
        const owner = { role: 'user', closure_status: 'active', full_name: 'Olivia Owner' };
        const base = { ...prepared(SUBMITTED).request, metered_at: '2026-10-01T00:00:00.000Z' };
        const check = async (overrides: Partial<Request>) => {
            vi.mocked(getRequestById).mockResolvedValueOnce({ ...base, ...overrides } as Request);
            return prepareSellerReminder({ requestId: SUBMITTED, adminPolicy: true, owner });
        };

        expect(await check({ status: 'in_progress', seller_edit_version: 1 })).toMatchObject({ ok: true });
        expect(await check({ status: 'in_progress', seller_edit_version: 0 })).toEqual({ ok: false, code: 'REQUEST_SUBMITTED' });
        expect(await check({ status: 'submitted', seller_edit_version: 2 })).toEqual({ ok: false, code: 'REQUEST_SUBMITTED' });
        expect(await check({ status: 'sent', seller_edit_version: 1 })).toEqual({ ok: false, code: 'REQUEST_SUBMITTED' });
    });

    it('rolls the claim back when the attempt audit cannot be written', async () => {
        await db.exec(`
            CREATE OR REPLACE FUNCTION test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN RAISE EXCEPTION 'forced audit failure'; END $$;
            CREATE TRIGGER test_fail_audit BEFORE INSERT ON admin_audit_logs FOR EACH ROW EXECUTE FUNCTION test_fail_audit();
        `);
        const send = accepted();
        await expect(run(op(1), adminActor, send)).rejects.toThrow(/forced audit failure/);
        await db.exec(`DROP TRIGGER test_fail_audit ON admin_audit_logs`);
        expect(send).not.toHaveBeenCalled();
        expect(await count('SELECT COUNT(*)::int AS n FROM reminder_operations')).toBe(0);
    });
});

describe('provider result classification', () => {
    it('separates accepted, definitive rejection, in-progress and ambiguous outcomes', () => {
        expect(classifyProviderResult({ success: true, messageId: 'm' })).toEqual({ kind: 'accepted', messageId: 'm' });
        expect(classifyProviderResult({ success: false, errorCode: 'validation_error' })).toEqual({ kind: 'rejected', code: 'validation_error' });
        expect(classifyProviderResult({ success: false, errorCode: 'rate_limit_exceeded' }).kind).toBe('rejected');
        expect(classifyProviderResult({ success: false, threw: true, error: 'RESEND_API_KEY environment variable is not set' }))
            .toEqual({ kind: 'rejected', code: 'email_not_configured' });
        expect(classifyProviderResult({ success: false, errorCode: 'concurrent_idempotent_requests' })).toEqual({ kind: 'in_progress' });
        expect(classifyProviderResult({ success: false, errorCode: 'internal_server_error' }).kind).toBe('unknown');
        expect(classifyProviderResult({ success: false, errorCode: 'invalid_idempotent_request' }).kind).toBe('unknown');
        expect(classifyProviderResult({ success: false, threw: true, error: 'socket hang up' }).kind).toBe('unknown');
    });
});
