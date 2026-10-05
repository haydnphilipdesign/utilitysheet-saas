// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSchemaDatabase, pgliteExecutor, queryRows } from '../helpers/pglite-db';
import { updateFeedbackStatus } from '@/lib/admin/feedback';
import type { AdminActor } from '@/lib/neon/queries/admin-writes';
import type { StatementExecutor } from '@/lib/neon/statements';

const ADMIN = '00000000-0000-4000-8000-0000000000a1';
const ADMIN_2 = '00000000-0000-4000-8000-0000000000a2';
const CUSTOMER = '00000000-0000-4000-8000-0000000000b1';
const FEEDBACK = '00000000-0000-4000-8000-0000000000f1';
const MESSAGE = 'Door code is 2468';

describe('updateFeedbackStatus', () => {
    let db: PGlite;
    let exec: StatementExecutor;
    const actor: AdminActor = { adminId: ADMIN, ipAddress: null, userAgent: 'vitest' };
    const one = async (text: string) => (await queryRows(db, text))[0];
    const act = (status: 'new' | 'reviewed' | 'resolved', expectedVersion: number, extra: Partial<Parameters<typeof updateFeedbackStatus>[0]> = {}) =>
        updateFeedbackStatus({
            db: exec, actor, feedbackId: FEEDBACK, status, expectedVersion, note: null, reason: 'Replied by email', ...extra,
        });

    beforeAll(async () => {
        // The migration is applied on top of the schema snapshot to prove it is idempotent.
        db = await createSchemaDatabase(['migrations-feedback-submissions.sql']);
        exec = pgliteExecutor(db);
    }, 60000);
    afterAll(async () => { await db?.close(); });

    beforeEach(async () => {
        await db.exec(`
            TRUNCATE feedback_submissions, admin_audit_logs, accounts CASCADE;
            INSERT INTO accounts (id, email, role) VALUES
                ('${ADMIN}', 'admin@example.com', 'admin'), ('${ADMIN_2}', 'admin2@example.com', 'admin'),
                ('${CUSTOMER}', 'customer@example.com', 'user');
            INSERT INTO feedback_submissions (id, account_id, category, message)
                VALUES ('${FEEDBACK}', '${CUSTOMER}', 'bug', '${MESSAGE}');
        `);
    });

    it('changes the status and audits it without copying the message or the note', async () => {
        expect(await act('reviewed', 1, { note: 'Private thought' })).toEqual({ outcome: 'OK', version: 2 });

        const row = await one('SELECT status, note, version, updated_by, status_changed_at FROM feedback_submissions');
        expect(row).toMatchObject({ status: 'reviewed', note: 'Private thought', version: 2, updated_by: ADMIN });
        expect(row.status_changed_at).toBeTruthy();

        const audit = await one('SELECT admin_id, target_user_id, action, metadata FROM admin_audit_logs');
        expect(audit).toMatchObject({ admin_id: ADMIN, target_user_id: CUSTOMER, action: 'feedback_status_changed' });
        expect(audit.metadata).toMatchObject({
            feedbackId: FEEDBACK, previousStatus: 'new', newStatus: 'reviewed', noteChanged: true, reason: 'Replied by email',
        });
        const serialized = JSON.stringify(audit.metadata);
        expect(serialized).not.toContain(MESSAGE);
        expect(serialized).not.toContain('Private thought');
    });

    it('still audits a change made without a reason', async () => {
        expect(await act('resolved', 1, { reason: null })).toEqual({ outcome: 'OK', version: 2 });

        const audit = await one('SELECT action, metadata FROM admin_audit_logs');
        expect(audit).toMatchObject({ action: 'feedback_status_changed', metadata: { newStatus: 'resolved' } });
        expect(audit.metadata).not.toHaveProperty('reason');
    });

    it('keeps an existing note when a later change supplies none', async () => {
        await act('reviewed', 1, { note: 'Keep me' });
        await act('resolved', 2);

        expect(await one('SELECT status, note FROM feedback_submissions')).toMatchObject({ status: 'resolved', note: 'Keep me' });
    });

    it('refuses a write based on a stale view and writes no audit entry for it', async () => {
        await act('reviewed', 1);

        expect(await act('resolved', 1, { actor: { ...actor, adminId: ADMIN_2 } })).toEqual({ outcome: 'STALE', version: null });
        expect(await one('SELECT status FROM feedback_submissions')).toMatchObject({ status: 'reviewed' });
        expect(Number((await one('SELECT COUNT(*)::int AS n FROM admin_audit_logs')).n)).toBe(1);
    });

    it('refuses an actor who is not an admin', async () => {
        expect(await act('resolved', 1, { actor: { ...actor, adminId: CUSTOMER } })).toEqual({ outcome: 'ACTOR_NOT_ADMIN', version: null });
        expect(await one('SELECT status, version FROM feedback_submissions')).toMatchObject({ status: 'new', version: 1 });
    });

    it('reports feedback that no longer exists', async () => {
        expect(await act('resolved', 1, { feedbackId: '00000000-0000-4000-8000-0000000000f9' }))
            .toEqual({ outcome: 'NOT_FOUND', version: null });
    });

    it('rejects values outside the stored constraints', async () => {
        await expect(db.exec(`INSERT INTO feedback_submissions (account_id, message) VALUES ('${CUSTOMER}', '')`)).rejects.toThrow();
        await expect(db.exec(`INSERT INTO feedback_submissions (account_id, message, category) VALUES ('${CUSTOMER}', 'x', 'rant')`)).rejects.toThrow();
    });
});
