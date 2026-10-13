// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSchemaDatabase, pgliteExecutor, queryRows } from '../helpers/pglite-db';
import { getMaintenanceHistory, readMaintenanceState, setMaintenanceStateAtomic } from '@/lib/neon/queries/maintenance';
import type { AdminActor } from '@/lib/neon/queries/admin-writes';
import type { StatementExecutor } from '@/lib/neon/statements';

const ADMIN = '00000000-0000-4000-8000-0000000000a1';
const CUSTOMER = '00000000-0000-4000-8000-0000000000b1';
const LATER = '2099-01-01T02:45:00.000Z';

describe('maintenance switch storage', () => {
    let db: PGlite;
    let exec: StatementExecutor;
    const actor: AdminActor = { adminId: ADMIN, ipAddress: '203.0.113.9', userAgent: 'vitest' };
    const set = (enabled: boolean, expectedBackAt: string | null = null, by: AdminActor = actor, reason: string | null = null) =>
        setMaintenanceStateAtomic({ db: exec, actor: by, reason, enabled, expectedBackAt });
    const audits = () => queryRows(db, 'SELECT action, metadata, admin_id, ip_address FROM admin_audit_logs ORDER BY created_at, id');

    beforeAll(async () => {
        // The migration is applied on top of the schema snapshot to prove it is idempotent.
        db = await createSchemaDatabase(['migrations-maintenance-state.sql', 'migrations-maintenance-state.sql']);
        exec = pgliteExecutor(db);
    }, 60000);
    afterAll(async () => { await db?.close(); });

    beforeEach(async () => {
        await db.exec(`
            TRUNCATE admin_audit_logs, accounts CASCADE;
            DELETE FROM maintenance_state;
            INSERT INTO maintenance_state (id) VALUES (TRUE);
            INSERT INTO accounts (id, email, role) VALUES
                ('${ADMIN}', 'admin@example.com', 'admin'), ('${CUSTOMER}', 'customer@example.com', 'user');
        `);
    });

    it('starts off, with exactly one row allowed', async () => {
        expect(await readMaintenanceState({ db: exec })).toEqual({ enabled: false, expectedBackAt: null, enabledAt: null, updatedAt: expect.any(String), version: 0 });
        await expect(db.exec('INSERT INTO maintenance_state (id) VALUES (TRUE)')).rejects.toThrow();
        await expect(db.exec('INSERT INTO maintenance_state (id) VALUES (FALSE)')).rejects.toThrow();
    });

    it('turns on with an estimate and writes one audit entry in the same statement', async () => {
        const result = await set(true, LATER, actor, 'Deploying a fix');
        expect(result).toEqual({ outcome: 'OK', state: { enabled: true, expectedBackAt: LATER, enabledAt: expect.any(String), updatedAt: expect.any(String), version: 1 } });
        expect(await readMaintenanceState({ db: exec })).toMatchObject({ enabled: true, expectedBackAt: LATER, version: 1 });
        const log = await audits();
        expect(log).toHaveLength(1);
        expect(log[0]).toMatchObject({ action: 'maintenance_enabled', admin_id: ADMIN, ip_address: '203.0.113.9' });
        expect(log[0].metadata).toMatchObject({ enabled: true, reason: 'Deploying a fix', userAgent: 'vitest' });
    });

    it('changes the estimate without restarting the pause, and a repeat changes nothing', async () => {
        const first = await set(true, null);
        if (first.outcome !== 'OK') throw new Error('expected OK');
        const updated = await set(true, LATER);
        expect(updated).toMatchObject({ outcome: 'OK', state: { enabled: true, expectedBackAt: LATER, enabledAt: first.state.enabledAt, version: 2 } });

        const repeat = await set(true, LATER);
        expect(repeat).toMatchObject({ outcome: 'UNCHANGED', state: { enabled: true, expectedBackAt: LATER, version: 2 } });
        expect((await audits()).map((row) => row.action)).toEqual(['maintenance_enabled', 'maintenance_updated']);
    });

    it('turns off, drops the estimate, and treats a second off as unchanged', async () => {
        await set(true, LATER);
        expect(await set(false, LATER)).toMatchObject({ outcome: 'OK', state: { enabled: false, expectedBackAt: null, enabledAt: null, version: 2 } });
        expect(await set(false)).toMatchObject({ outcome: 'UNCHANGED', state: { enabled: false } });
        expect((await audits()).map((row) => row.action)).toEqual(['maintenance_enabled', 'maintenance_disabled']);
    });

    it('refuses a non-admin and an unknown account without changing or auditing anything', async () => {
        expect(await set(true, null, { ...actor, adminId: CUSTOMER })).toEqual({ outcome: 'ACTOR_NOT_ADMIN' });
        expect(await set(true, null, { ...actor, adminId: '00000000-0000-4000-8000-0000000000ff' })).toEqual({ outcome: 'ACTOR_NOT_ADMIN' });
        expect(await readMaintenanceState({ db: exec })).toMatchObject({ enabled: false, version: 0 });
        expect(await audits()).toEqual([]);
    });

    it('still works if the seeded row is missing', async () => {
        await db.exec('DELETE FROM maintenance_state');
        expect(await readMaintenanceState({ db: exec })).toMatchObject({ enabled: false, version: 0 });
        expect(await set(true)).toMatchObject({ outcome: 'OK', state: { enabled: true, version: 1 } });
    });

    it('lists recent changes with who made them, newest first', async () => {
        await set(true);
        await set(false);
        const history = await getMaintenanceHistory(8, { db: exec });
        expect(history.map((entry) => entry.action).sort()).toEqual(['maintenance_disabled', 'maintenance_enabled']);
        expect(history.every((entry) => entry.adminEmail === 'admin@example.com' && entry.createdAt)).toBe(true);
    });

    it('reports a database without the migration as not installed, and other failures as failures', async () => {
        const missing: StatementExecutor = { run: async () => { throw Object.assign(new Error('relation does not exist'), { code: '42P01' }); }, transaction: async () => [] };
        expect(await readMaintenanceState({ db: missing })).toBeNull();
        const broken: StatementExecutor = { run: async () => { throw new Error('connection lost'); }, transaction: async () => [] };
        await expect(readMaintenanceState({ db: broken })).rejects.toThrow('connection lost');
    });
});