// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSchemaDatabase, pgliteExecutor, queryRows } from '../helpers/pglite-db';
import type { StatementExecutor } from '@/lib/neon/statements';
import {
    changeAccountPlan,
    changeAccountRole,
    correctRequestStatus,
    createProductUpdateDraft,
    deleteProductUpdateAtomic,
    insertAdminAudit,
    publishProductUpdateAtomic,
    updateRequestSellerContact,
    type AdminActor,
} from '@/lib/neon/queries/admin-writes';

// Real schema.sql in disposable embedded PostgreSQL. No credentials are read.
const ADMIN_A = '00000000-0000-4000-8000-0000000000a1';
const ADMIN_B = '00000000-0000-4000-8000-0000000000a2';
const USER = '00000000-0000-4000-8000-0000000000b1';
const TEAM_USER = '00000000-0000-4000-8000-0000000000b2';
const CLOSING_USER = '00000000-0000-4000-8000-0000000000b3';
const TEAM_ORG = '00000000-0000-4000-8000-0000000000c1';
const REQ_OPEN = '00000000-0000-4000-8000-0000000000d1';
const REQ_SUBMITTED = '00000000-0000-4000-8000-0000000000d2';
const REQ_DRIFTED = '00000000-0000-4000-8000-0000000000d3';
const REQ_DELETED = '00000000-0000-4000-8000-0000000000d4';
const REQ_DEMO = '00000000-0000-4000-8000-0000000000d5';

type Status = 'draft' | 'sent' | 'in_progress' | 'submitted';

let db: PGlite;
let exec: StatementExecutor;
const actorA: AdminActor = { adminId: ADMIN_A, ipAddress: '203.0.113.5', userAgent: 'vitest' };
const actorB: AdminActor = { adminId: ADMIN_B, ipAddress: null, userAgent: null };
const reason = 'Support ticket 123';

const one = async (text: string, params: unknown[] = []) => (await queryRows(db, text, params))[0];
const count = async (text: string, params: unknown[] = []) => Number((await one(text, params)).n);
const auditCount = () => count('SELECT COUNT(*)::int AS n FROM admin_audit_logs');

async function failInserts(table: 'admin_audit_logs' | 'event_logs', run: () => Promise<unknown>) {
    await db.exec(`
        CREATE OR REPLACE FUNCTION test_fail_insert() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'forced % failure', TG_TABLE_NAME; END $$;
        CREATE TRIGGER test_fail_insert BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION test_fail_insert();
    `);
    try {
        await run();
    } finally {
        await db.exec(`DROP TRIGGER test_fail_insert ON ${table}`);
    }
}

beforeAll(async () => {
    db = await createSchemaDatabase();
    exec = pgliteExecutor(db);
}, 60000);
afterAll(async () => { await db?.close(); });

beforeEach(async () => {
    await db.exec(`
        TRUNCATE admin_audit_logs, event_logs, product_updates, requests, organization_members, accounts, organizations CASCADE;
        INSERT INTO organizations (id, name, slug, subscription_status) VALUES ('${TEAM_ORG}', 'Team', 'team', 'team');
        INSERT INTO accounts (id, email, role, subscription_status, active_organization_id, closure_status) VALUES
            ('${ADMIN_A}', 'a@example.com', 'admin', 'free', NULL, 'active'),
            ('${ADMIN_B}', 'b@example.com', 'admin', 'free', NULL, 'active'),
            ('${USER}', 'user@example.com', 'user', 'free', NULL, 'active'),
            ('${TEAM_USER}', 'team@example.com', 'user', 'free', '${TEAM_ORG}', 'active'),
            ('${CLOSING_USER}', 'closing@example.com', 'user', 'free', NULL, 'closing');
        INSERT INTO requests (id, account_id, property_address, seller_name, seller_email, seller_phone, status,
                public_token, seller_token, metered_at, deleted_at, is_demo, last_activity_at) VALUES
            ('${REQ_OPEN}', '${USER}', '1 Open St', 'Sam Seller', 'sam@example.com', NULL, 'sent', 'pub1', 'sel1', NULL, NULL, FALSE, '2026-01-01T00:00:00Z'),
            ('${REQ_SUBMITTED}', '${USER}', '2 Done St', NULL, NULL, NULL, 'submitted', 'pub2', 'sel2', '2026-02-01T00:00:00Z', NULL, FALSE, '2026-02-01T00:00:00Z'),
            ('${REQ_DRIFTED}', '${USER}', '3 Drift St', NULL, NULL, NULL, 'in_progress', 'pub3', 'sel3', '2026-02-01T00:00:00Z', NULL, FALSE, '2026-02-01T00:00:00Z'),
            ('${REQ_DELETED}', '${USER}', '4 Gone St', NULL, 'gone@example.com', NULL, 'sent', 'pub4', 'sel4', '2026-02-01T00:00:00Z', NOW(), FALSE, '2026-02-01T00:00:00Z'),
            ('${REQ_DEMO}', '${USER}', '5 Demo St', NULL, NULL, NULL, 'submitted', 'pub5', 'sel5', NULL, NULL, TRUE, '2026-02-01T00:00:00Z');
    `);
});

describe('account role changes', () => {
    const demote = (actor = actorA, targetId = ADMIN_B, expectedRole: 'admin' | 'user' | 'banned' = 'admin') =>
        changeAccountRole({ db: exec, actor, reason, targetId, nextRole: 'user', expectedRole, action: 'role_changed' });

    it('commits the role change with before/after audit evidence', async () => {
        expect(await demote()).toEqual({ outcome: 'OK', previousRole: 'admin' });
        expect((await one('SELECT role FROM accounts WHERE id = $1', [ADMIN_B])).role).toBe('user');
        const audit = await one('SELECT * FROM admin_audit_logs');
        expect(audit).toMatchObject({ admin_id: ADMIN_A, target_user_id: ADMIN_B, action: 'role_changed', ip_address: '203.0.113.5' });
        expect(audit.metadata).toMatchObject({ reason, previousRole: 'admin', newRole: 'user', userAgent: 'vitest' });
    });

    it('rolls the role change back when the audit insert fails', async () => {
        await failInserts('admin_audit_logs', async () => {
            await expect(demote()).rejects.toThrow(/forced admin_audit_logs failure/);
        });
        expect((await one('SELECT role FROM accounts WHERE id = $1', [ADMIN_B])).role).toBe('admin');
        expect(await auditCount()).toBe(0);
    });

    it('leaves one admin when two admins demote each other in sequence', async () => {
        // Under the advisory lock the second change runs against the first one's result.
        expect((await demote(actorA, ADMIN_B)).outcome).toBe('OK');
        expect((await demote(actorB, ADMIN_A)).outcome).toBe('ACTOR_NOT_ADMIN');
        expect(await count("SELECT COUNT(*)::int AS n FROM accounts WHERE role = 'admin'")).toBe(1);
    });

    it('blocks self-demotion and self-ban and records the blocked attempt', async () => {
        expect((await demote(actorA, ADMIN_A)).outcome).toBe('SELF_BLOCKED');
        const ban = await changeAccountRole({
            db: exec, actor: actorA, reason, targetId: ADMIN_A, nextRole: 'banned', expectedRole: 'admin', action: 'user_banned',
        });
        expect(ban.outcome).toBe('SELF_BLOCKED');
        expect((await one('SELECT role FROM accounts WHERE id = $1', [ADMIN_A])).role).toBe('admin');
        const audits = await queryRows(db, 'SELECT action, metadata FROM admin_audit_logs ORDER BY action');
        expect(audits).toHaveLength(2);
        expect(audits[0].metadata).toMatchObject({ blocked: true, code: 'SELF_BLOCKED', attemptedRole: 'user' });
    });

    it('refuses stale, no-op, promotion, closing and missing targets without changing roles', async () => {
        expect((await demote(actorA, ADMIN_B, 'user')).outcome).toBe('STALE');
        expect((await demote(actorA, USER, 'user')).outcome).toBe('NO_OP');
        expect((await demote(actorA, CLOSING_USER, 'user')).outcome).toBe('ACCOUNT_NOT_ACTIVE');
        expect((await demote(actorA, '00000000-0000-4000-8000-00000000ffff')).outcome).toBe('NOT_FOUND');
        const promote = await changeAccountRole({
            db: exec, actor: actorA, reason, targetId: USER, nextRole: 'admin', expectedRole: 'user', action: 'role_changed',
        });
        expect(promote.outcome).toBe('ADMIN_PROMOTION_DISABLED');
        expect(await count("SELECT COUNT(*)::int AS n FROM accounts WHERE role = 'admin'")).toBe(2);
        // Only the policy block is audited; stale, no-op and missing targets leave no misleading entries.
        expect(await auditCount()).toBe(1);
    });

    it('refuses a non-admin actor at the database boundary', async () => {
        const result = await changeAccountRole({
            db: exec, actor: { ...actorA, adminId: USER }, reason, targetId: ADMIN_B, nextRole: 'user', expectedRole: 'admin', action: 'role_changed',
        });
        expect(result.outcome).toBe('ACTOR_NOT_ADMIN');
        expect(await auditCount()).toBe(0);
    });
});

describe('entitlement overrides', () => {
    const setPlan = (targetId: string, nextPlan: 'free' | 'pro', expectedPlan: 'free' | 'pro' | 'canceled') =>
        changeAccountPlan({ db: exec, actor: actorA, reason, targetId, nextPlan, expectedPlan });

    it('commits the override with audit evidence and leaves billing identifiers alone', async () => {
        await db.exec(`UPDATE accounts SET stripe_customer_id = 'cus_test', subscription_id = 'sub_test' WHERE id = '${USER}'`);
        expect(await setPlan(USER, 'pro', 'free')).toEqual({ outcome: 'OK', previousPlan: 'free' });
        expect(await one('SELECT subscription_status, stripe_customer_id, subscription_id FROM accounts WHERE id = $1', [USER]))
            .toEqual({ subscription_status: 'pro', stripe_customer_id: 'cus_test', subscription_id: 'sub_test' });
        expect((await one('SELECT metadata FROM admin_audit_logs')).metadata).toMatchObject({ previousPlan: 'free', newPlan: 'pro' });
    });

    it('blocks Team-managed accounts and records the blocked attempt', async () => {
        expect((await setPlan(TEAM_USER, 'pro', 'free')).outcome).toBe('ORG_TEAM_MANAGED_PLAN');
        expect((await one('SELECT subscription_status FROM accounts WHERE id = $1', [TEAM_USER])).subscription_status).toBe('free');
        expect((await one('SELECT metadata FROM admin_audit_logs')).metadata).toMatchObject({
            blocked: true, code: 'ORG_TEAM_MANAGED_PLAN', activeOrganizationId: TEAM_ORG,
        });
    });

    it('refuses stale, no-op and closing accounts; rolls back on audit failure', async () => {
        expect((await setPlan(USER, 'pro', 'pro')).outcome).toBe('STALE');
        expect((await setPlan(USER, 'free', 'free')).outcome).toBe('NO_OP');
        expect((await setPlan(CLOSING_USER, 'pro', 'free')).outcome).toBe('ACCOUNT_NOT_ACTIVE');
        await failInserts('admin_audit_logs', async () => {
            await expect(setPlan(USER, 'pro', 'free')).rejects.toThrow(/forced/);
        });
        expect((await one('SELECT subscription_status FROM accounts WHERE id = $1', [USER])).subscription_status).toBe('free');
    });
});

describe('request status corrections', () => {
    const correct = (requestId: string, nextStatus: Status, expectedStatus: Status) =>
        correctRequestStatus({ db: exec, actor: actorA, reason, requestId, nextStatus, expectedStatus });
    const snapshot = (id: string) =>
        one('SELECT status, metered_at, last_activity_at, public_token, seller_token, is_locked FROM requests WHERE id = $1', [id]);

    it('corrects an unmetered request without any submission side effect', async () => {
        const before = await snapshot(REQ_OPEN);
        expect(await correct(REQ_OPEN, 'in_progress', 'sent')).toEqual({ outcome: 'OK', previousStatus: 'sent' });
        expect(await snapshot(REQ_OPEN)).toEqual({ ...before, status: 'in_progress' });
        expect(before.metered_at).toBeNull();
        expect((await one('SELECT metadata FROM admin_audit_logs')).metadata).toMatchObject({
            requestId: REQ_OPEN, previousStatus: 'sent', newStatus: 'in_progress', correction: true,
        });
        expect(await one('SELECT event_type, event_data FROM event_logs')).toMatchObject({
            event_type: 'admin_request_status_changed',
            event_data: { actor: 'admin', previousStatus: 'sent', newStatus: 'in_progress', reason },
        });
    });

    it('cannot synthesize a submission, reopen a metered one, or touch deleted and unmetered-submitted records', async () => {
        expect((await correct(REQ_OPEN, 'submitted', 'sent')).outcome).toBe('SUBMISSION_REQUIRES_SELLER');
        expect((await correct(REQ_SUBMITTED, 'in_progress', 'submitted')).outcome).toBe('SUBMITTED_LOCKED');
        expect((await correct(REQ_DRIFTED, 'draft', 'in_progress')).outcome).toBe('METERED_RESTORE_ONLY');
        expect((await correct(REQ_DELETED, 'draft', 'sent')).outcome).toBe('REQUEST_DELETED');
        expect((await correct(REQ_DEMO, 'draft', 'submitted')).outcome).toBe('UNMETERED_SUBMITTED_REVIEW');
        expect((await correct(REQ_OPEN, 'draft', 'in_progress')).outcome).toBe('STALE');
        expect((await correct(REQ_OPEN, 'sent', 'sent')).outcome).toBe('NO_OP');
        expect(await auditCount()).toBe(0);
        expect(await count('SELECT COUNT(*)::int AS n FROM event_logs')).toBe(0);
        expect(await count('SELECT COUNT(*)::int AS n FROM requests WHERE metered_at IS NOT NULL')).toBe(3);
    });

    it('restores a metered request to Submitted without changing metering', async () => {
        const before = await snapshot(REQ_DRIFTED);
        expect((await correct(REQ_DRIFTED, 'submitted', 'in_progress')).outcome).toBe('OK');
        expect(await snapshot(REQ_DRIFTED)).toEqual({ ...before, status: 'submitted' });
    });

    it('rolls back the correction when either the audit or the timeline insert fails', async () => {
        for (const table of ['admin_audit_logs', 'event_logs'] as const) {
            await failInserts(table, async () => {
                await expect(correct(REQ_OPEN, 'draft', 'sent')).rejects.toThrow(/forced/);
            });
            expect((await snapshot(REQ_OPEN)).status).toBe('sent');
        }
        expect(await auditCount()).toBe(0);
        expect(await count('SELECT COUNT(*)::int AS n FROM event_logs')).toBe(0);
    });
});

describe('seller contact edits', () => {
    type Contact = { sellerName: string | null; sellerEmail: string | null; sellerPhone: string | null };
    const current: Contact = { sellerName: 'Sam Seller', sellerEmail: 'sam@example.com', sellerPhone: null };
    const edit = (requestId: string, seller: Contact, expected: Contact = current) =>
        updateRequestSellerContact({ db: exec, actor: actorA, reason, requestId, seller, expected });

    it('commits the edit, audit and timeline together without resetting seller activity', async () => {
        const next = { sellerName: 'Samantha Seller', sellerEmail: 'samantha@example.com', sellerPhone: '555-0100' };
        expect((await edit(REQ_OPEN, next)).outcome).toBe('OK');
        const row = await one('SELECT seller_name, seller_email, seller_phone, last_activity_at FROM requests WHERE id = $1', [REQ_OPEN]);
        expect(row).toMatchObject({ seller_name: 'Samantha Seller', seller_email: 'samantha@example.com', seller_phone: '555-0100' });
        expect(new Date(row.last_activity_at as string).toISOString()).toBe('2026-01-01T00:00:00.000Z');
        expect((await one('SELECT metadata FROM admin_audit_logs')).metadata).toMatchObject({
            before: { seller_email: 'sam@example.com' }, after: { seller_email: 'samantha@example.com' },
        });
        expect(await count("SELECT COUNT(*)::int AS n FROM event_logs WHERE event_type = 'admin_request_seller_updated'")).toBe(1);
    });

    it('refuses stale, unchanged and deleted edits, and rolls back on timeline failure', async () => {
        const next = { ...current, sellerPhone: '555-0100' };
        expect((await edit(REQ_OPEN, next, { ...current, sellerEmail: 'old@example.com' })).outcome).toBe('STALE');
        expect((await edit(REQ_OPEN, current)).outcome).toBe('NO_OP');
        expect((await edit(REQ_DELETED, next, { sellerName: null, sellerEmail: 'gone@example.com', sellerPhone: null })).outcome)
            .toBe('REQUEST_DELETED');
        await failInserts('event_logs', async () => {
            await expect(edit(REQ_OPEN, next)).rejects.toThrow(/forced/);
        });
        expect((await one('SELECT seller_phone FROM requests WHERE id = $1', [REQ_OPEN])).seller_phone).toBeNull();
        expect(await auditCount()).toBe(0);
    });
});

describe('Product Update writes', () => {
    const draft = () =>
        createProductUpdateDraft({ db: exec, actor: actorA, reason, title: 'Faster packets', body: 'Details', category: 'feature' });

    it('creates drafts only, with audit evidence in the same statement', async () => {
        const result = await draft();
        expect(result.outcome).toBe('OK');
        expect(result.update).toMatchObject({ title: 'Faster packets', is_published: false, created_by: ADMIN_A });
        expect(await one('SELECT action, metadata FROM admin_audit_logs')).toMatchObject({
            action: 'product_update_created', metadata: { updateId: result.update!.id, is_published: false },
        });
        await failInserts('admin_audit_logs', async () => { await expect(draft()).rejects.toThrow(/forced/); });
        expect(await count('SELECT COUNT(*)::int AS n FROM product_updates')).toBe(1);
    });

    it('publishes once; a repeat is a truthful no-op with no second audit entry', async () => {
        const id = (await draft()).update!.id;
        const first = await publishProductUpdateAtomic({ db: exec, actor: actorA, reason, updateId: id });
        expect(first).toMatchObject({ outcome: 'OK', update: { is_published: true } });
        const second = await publishProductUpdateAtomic({ db: exec, actor: actorA, reason, updateId: id });
        expect(second).toMatchObject({ outcome: 'ALREADY_PUBLISHED', update: { id, published_at: first.update!.published_at } });
        expect(await count("SELECT COUNT(*)::int AS n FROM admin_audit_logs WHERE action = 'product_update_published'")).toBe(1);
        expect((await publishProductUpdateAtomic({ db: exec, actor: actorA, reason, updateId: USER })).outcome).toBe('NOT_FOUND');
    });

    it('deletes once with evidence; rolls back when audit fails; repeat finds nothing', async () => {
        const id = (await draft()).update!.id;
        await failInserts('admin_audit_logs', async () => {
            await expect(deleteProductUpdateAtomic({ db: exec, actor: actorA, reason, updateId: id })).rejects.toThrow(/forced/);
        });
        expect(await count('SELECT COUNT(*)::int AS n FROM product_updates')).toBe(1);
        expect((await deleteProductUpdateAtomic({ db: exec, actor: actorA, reason, updateId: id })).outcome).toBe('OK');
        expect((await deleteProductUpdateAtomic({ db: exec, actor: actorA, reason, updateId: id })).outcome).toBe('NOT_FOUND');
        expect(await count("SELECT COUNT(*)::int AS n FROM admin_audit_logs WHERE action = 'product_update_deleted'")).toBe(1);
    });

    it('refuses writes from an actor who is no longer an admin', async () => {
        const nonAdmin = { ...actorA, adminId: USER };
        const created = await createProductUpdateDraft({ db: exec, actor: nonAdmin, reason, title: 'Nope', body: 'Nope', category: 'feature' });
        expect(created.outcome).toBe('ACTOR_NOT_ADMIN');
        await expect(insertAdminAudit({ db: exec, actor: nonAdmin, action: 'auth_reconciliation_started', metadata: {} }))
            .rejects.toThrow('Admin audit entry was not recorded');
        expect(await count('SELECT COUNT(*)::int AS n FROM product_updates')).toBe(0);
    });
});
