// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSchemaDatabase, pgliteExecutor, queryRows } from '../helpers/pglite-db';
import type { StatementExecutor } from '@/lib/neon/statements';
import {
    cancelRequestReopen,
    reopenSubmittedRequest,
    submitSellerRequest,
    type SellerSubmissionEntryRow,
    type SubmitSellerRequestInput,
} from '@/lib/neon/queries/seller-submission';
import { createEmptyHoaAnswers } from '@/lib/packet/hoa';

/*
 * Real schema.sql in disposable embedded PostgreSQL. No credentials are read.
 * PGlite is one connection: these tests prove the decision logic, constraints
 * and all-or-nothing writes. Lock waits between two connections need the
 * harness described in tests/concurrency/README.md.
 */

const OWNER = '00000000-0000-4000-8000-0000000000e1';
const OTHER = '00000000-0000-4000-8000-0000000000e2';
const ORG = '00000000-0000-4000-8000-0000000000e3';
const REQUEST = '00000000-0000-4000-8000-0000000000f1';
const ADDRESS = '12 Original Road, Easton, PA 18040';
const METERED_AT = '2026-09-01T12:00:00.000Z';

let db: PGlite;
let exec: StatementExecutor;

const one = async (text: string, params: unknown[] = []) => (await queryRows(db, text, params))[0];
const requestRow = () => one('SELECT * FROM requests WHERE id = $1', [REQUEST]);
const entries = () => queryRows(db, 'SELECT category, display_name, entry_mode, contact_phone, meter_number FROM utility_entries WHERE request_id = $1 ORDER BY category', [REQUEST]);
const events = async (type: string) => Number((await one('SELECT COUNT(*)::int AS n FROM event_logs WHERE request_id = $1 AND event_type = $2', [REQUEST, type])).n);

const entry = (category: string, name: string | null, extra: Partial<SellerSubmissionEntryRow> = {}): SellerSubmissionEntryRow => ({
    category,
    entry_mode: name ? 'free_text' : 'unknown',
    display_name: name,
    raw_text: name,
    canonical_id: null,
    confidence_score: null,
    contact_phone: null,
    contact_url: null,
    meter_number: null,
    extra: {},
    ...extra,
});

function submission(overrides: Partial<SubmitSellerRequestInput> = {}): SubmitSellerRequestInput {
    return {
        executor: exec,
        requestId: REQUEST,
        editVersion: 0,
        submissionKey: 'key-session-0',
        waterSource: 'city',
        sewerType: 'public',
        heatingType: 'natural_gas',
        updateHoa: true,
        hoa: { ...createEmptyHoaAnswers(), has_hoa: 'no' },
        advancedPacketData: {},
        entries: [entry('electric', 'First Power'), entry('water', 'First Water')],
        isTestDrive: false,
        eventData: { actor: 'seller' },
        ipAddress: '203.0.113.9',
        userAgent: 'vitest',
        ...overrides,
    };
}

const actor = { actorAccountId: OWNER, ipAddress: null, userAgent: null };

async function seedRequest(columns: Record<string, unknown> = {}, options: { keep?: boolean } = {}) {
    if (!options.keep) await db.exec('DELETE FROM requests');
    const row = {
        id: REQUEST,
        account_id: OWNER,
        organization_id: ORG,
        property_address: ADDRESS,
        public_token: 'public-token',
        seller_token: 'seller-token',
        status: 'in_progress',
        ...columns,
    };
    const keys = Object.keys(row);
    await db.query(
        `INSERT INTO requests (${keys.join(', ')}) VALUES (${keys.map((_, index) => `$${index + 1}`).join(', ')})`,
        Object.values(row)
    );
}

beforeAll(async () => {
    // The migration is applied on top of the snapshot to prove it is idempotent with it.
    db = await createSchemaDatabase(['migrations-seller-edit-sessions.sql']);
    exec = pgliteExecutor(db);
    await db.query('INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)', [ORG, 'Workspace', 'workspace-fixture']);
    await db.query(
        'INSERT INTO accounts (id, auth_user_id, email) VALUES ($1, $2, $3), ($4, $5, $6)',
        [OWNER, 'auth-owner', 'owner@example.test', OTHER, 'auth-other', 'other@example.test']
    );
}, 60000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => { await seedRequest(); });

describe('seller submission statement', () => {
    it('stores the request, provider rows and event together', async () => {
        const result = await submitSellerRequest(submission());

        expect(result.outcome).toBe('ACCEPTED');
        expect(result.request).toMatchObject({ id: REQUEST, status: 'submitted', water_source: 'city', has_hoa: 'no' });
        expect(await entries()).toEqual([
            expect.objectContaining({ category: 'electric', display_name: 'First Power' }),
            expect.objectContaining({ category: 'water', display_name: 'First Water' }),
        ]);
        expect(await events('seller_submitted')).toBe(1);
        const stored = await requestRow();
        expect(stored.metered_at).not.toBeNull();
        expect(stored.seller_submission_key).toBe('key-session-0');
    });

    it('stores nothing when a provider row cannot be written', async () => {
        await submitSellerRequest(submission());
        await reopenSubmittedRequest({ executor: exec, requestId: REQUEST, ...actor });
        const before = await requestRow();

        // entry_mode has a CHECK constraint; the bad row fails after the update and delete ran.
        await expect(submitSellerRequest(submission({
            editVersion: 1,
            submissionKey: 'key-session-1',
            waterSource: 'well',
            entries: [entry('electric', 'Replacement Power'), { ...entry('water', 'Bad Row'), entry_mode: 'not-a-mode' }],
        }))).rejects.toThrow();

        const after = await requestRow();
        expect(after.status).toBe('in_progress');
        expect(after.water_source).toBe('city');
        expect(after.seller_submission_key).toBe(before.seller_submission_key);
        expect((await entries()).map((row) => row.display_name)).toEqual(['First Power', 'First Water']);
        expect(await events('seller_submitted')).toBe(1);

        // The seller can retry after the failure.
        const retry = await submitSellerRequest(submission({ editVersion: 1, submissionKey: 'key-session-1' }));
        expect(retry.outcome).toBe('ACCEPTED');
    });

    it('stores nothing when the event cannot be written', async () => {
        await db.exec(`
            CREATE OR REPLACE FUNCTION test_fail_insert() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN RAISE EXCEPTION 'forced event failure'; END $$;
            CREATE TRIGGER test_fail_insert BEFORE INSERT ON event_logs FOR EACH ROW EXECUTE FUNCTION test_fail_insert();
        `);
        try {
            await expect(submitSellerRequest(submission())).rejects.toThrow(/forced event failure/);
        } finally {
            await db.exec('DROP TRIGGER test_fail_insert ON event_logs');
        }
        expect((await requestRow()).status).toBe('in_progress');
        expect(await entries()).toEqual([]);
    });

    it('refuses a second, different submission once submitted and leaves the sheet alone', async () => {
        await submitSellerRequest(submission());
        // What the loser of two simultaneous submissions sees after waiting for the row lock.
        const second = await submitSellerRequest(submission({
            submissionKey: 'another-tab',
            waterSource: 'not_sure',
            entries: [entry('electric', null)],
        }));

        expect(second.outcome).toBe('ALREADY_SUBMITTED');
        expect(second.request).toBeNull();
        expect((await requestRow()).water_source).toBe('city');
        expect((await entries()).map((row) => row.display_name)).toEqual(['First Power', 'First Water']);
        expect(await events('seller_submitted')).toBe(1);
    });

    it('answers a retry with the same key as a duplicate without writing again', async () => {
        await submitSellerRequest(submission());
        const retry = await submitSellerRequest(submission({ entries: [entry('electric', 'Tampered Retry')] }));

        expect(retry.outcome).toBe('DUPLICATE');
        expect((await entries()).map((row) => row.display_name)).toEqual(['First Power', 'First Water']);
        expect(await events('seller_submitted')).toBe(1);
    });

    it('does not treat a missing key as a duplicate', async () => {
        await submitSellerRequest(submission({ submissionKey: null }));
        expect((await submitSellerRequest(submission({ submissionKey: null }))).outcome).toBe('ALREADY_SUBMITTED');
    });

    it('never changes the address, owner, workspace or tokens', async () => {
        await submitSellerRequest(submission());
        expect(await requestRow()).toMatchObject({
            property_address: ADDRESS,
            account_id: OWNER,
            organization_id: ORG,
            public_token: 'public-token',
            seller_token: 'seller-token',
        });
    });

    it('does not meter a test-drive submission', async () => {
        await seedRequest({ is_demo: true });
        await submitSellerRequest(submission({ isTestDrive: true }));
        expect((await requestRow()).metered_at).toBeNull();
    });

    it('reports a deleted or unknown request as not found', async () => {
        await db.query('UPDATE requests SET deleted_at = NOW() WHERE id = $1', [REQUEST]);
        expect((await submitSellerRequest(submission())).outcome).toBe('NOT_FOUND');
        expect((await submitSellerRequest(submission({ requestId: '00000000-0000-4000-8000-00000000ffff' }))).outcome).toBe('NOT_FOUND');
    });
});

describe('Free monthly limit, decided when the submission is stored', () => {
    const MONTH_START = "date_trunc('month', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'";
    let seeded = 0;

    /** Other requests of an account, as earlier submissions would have left them. */
    async function seedOthers(count: number, columns: { accountId?: string; organizationId?: string | null; meteredAt?: string | null; set?: string } = {}) {
        for (let i = 0; i < count; i += 1) {
            seeded += 1;
            // meteredAt and set are SQL written in this file, never input.
            await db.query(
                `INSERT INTO requests (account_id, organization_id, property_address, public_token, seller_token, status, metered_at)
                 VALUES ($1, $2, $3, $4, $5, 'submitted', ${columns.meteredAt === undefined ? 'NOW()' : columns.meteredAt ?? 'NULL'})`,
                [columns.accountId ?? OWNER, columns.organizationId === undefined ? ORG : columns.organizationId, `${seeded} Earlier Road`, `public-${seeded}`, `seller-${seeded}`]
            );
            if (columns.set) await db.query(`UPDATE requests SET ${columns.set} WHERE public_token = $1`, [`public-${seeded}`]);
        }
    }
    const setPlans = (account: string, organization: string) => db.exec(`
        UPDATE accounts SET subscription_status = '${account}' WHERE id = '${OWNER}';
        UPDATE organizations SET subscription_status = '${organization}' WHERE id = '${ORG}';
    `);
    const lockState = async () => {
        const row = await requestRow();
        return { is_locked: row.is_locked, locked_reason: row.locked_reason, metered: row.metered_at !== null, locked_at: row.locked_at !== null };
    };
    const unlocked = { is_locked: false, locked_reason: null, metered: true, locked_at: false };
    const locked = { is_locked: true, locked_reason: 'monthly_limit', metered: true, locked_at: true };

    beforeEach(async () => { await setPlans('free', 'free'); });
    afterAll(async () => { await setPlans('free', 'free'); });

    it('stores the last allowed submission unlocked and the next one locked', async () => {
        await seedOthers(2);
        expect((await submitSellerRequest(submission())).request).toMatchObject({ is_locked: false });
        expect(await lockState()).toEqual(unlocked);

        // The request above is now the third counted one.
        await seedRequest({ id: '00000000-0000-4000-8000-0000000000f2', public_token: 'public-next', seller_token: 'seller-next' }, { keep: true });
        const next = await submitSellerRequest(submission({ requestId: '00000000-0000-4000-8000-0000000000f2', submissionKey: 'next' }));
        expect(next.outcome).toBe('ACCEPTED');
        expect(next.request).toMatchObject({ is_locked: true, locked_reason: 'monthly_limit' });
        // Locked submissions do not count, so the first one is untouched.
        expect(await lockState()).toEqual(unlocked);
    });

    it('locks at the limit and keeps metering the locked submission', async () => {
        await seedOthers(3);
        await submitSellerRequest(submission());
        expect(await lockState()).toEqual(locked);
    });

    it('counts soft-deleted rows and rows in another workspace of the same owner', async () => {
        await seedOthers(1, { set: 'deleted_at = NOW()' });
        await seedOthers(2, { organizationId: null });
        await submitSellerRequest(submission());
        expect(await lockState()).toEqual(locked);
    });

    it('does not count locked, test-drive, unmetered, earlier-month or other-account rows', async () => {
        await seedOthers(3, { set: 'is_locked = TRUE' });
        await seedOthers(3, { set: 'is_demo = TRUE' });
        await seedOthers(3, { meteredAt: null });
        await seedOthers(3, { meteredAt: `${MONTH_START} - INTERVAL '1 second'` });
        await seedOthers(3, { accountId: OTHER });
        await submitSellerRequest(submission());
        expect(await lockState()).toEqual(unlocked);
    });

    it('does not count the owner\'s submissions in a Team workspace against another workspace', async () => {
        const TEAM_ORG = '00000000-0000-4000-8000-0000000000e4';
        await db.query(
            "INSERT INTO organizations (id, name, slug, subscription_status) VALUES ($1, 'Team Workspace', 'team-fixture', 'team') ON CONFLICT (id) DO UPDATE SET subscription_status = 'team'",
            [TEAM_ORG]
        );
        await seedOthers(10, { organizationId: TEAM_ORG });
        await seedOthers(2);
        await submitSellerRequest(submission());
        expect(await lockState()).toEqual(unlocked);

        // Once that workspace is no longer on Team, its sheets count like any other.
        await db.query("UPDATE organizations SET subscription_status = 'free' WHERE id = $1", [TEAM_ORG]);
        await seedRequest({ id: '00000000-0000-4000-8000-0000000000f3', public_token: 'public-after', seller_token: 'seller-after' }, { keep: true });
        const after = await submitSellerRequest(submission({ requestId: '00000000-0000-4000-8000-0000000000f3', submissionKey: 'after' }));
        expect(after.request).toMatchObject({ is_locked: true });
    });

    it('counts a submission metered at the first instant of the UTC month', async () => {
        await seedOthers(3, { meteredAt: MONTH_START });
        await submitSellerRequest(submission());
        expect(await lockState()).toEqual(locked);
    });

    it('never locks a Pro owner or a request in a Team workspace', async () => {
        await seedOthers(5);
        await setPlans('pro', 'free');
        await submitSellerRequest(submission());
        expect(await lockState()).toEqual(unlocked);

        await seedRequest();
        await seedOthers(5);
        await setPlans('free', 'team');
        await submitSellerRequest(submission());
        expect(await lockState()).toEqual(unlocked);
    });

    it('never locks or recounts a resubmission after a reopen, even over the limit', async () => {
        await submitSellerRequest(submission());
        await db.query('UPDATE requests SET metered_at = $2 WHERE id = $1', [REQUEST, METERED_AT]);
        await seedOthers(5);
        await reopenSubmittedRequest({ executor: exec, requestId: REQUEST, ...actor });

        const result = await submitSellerRequest(submission({ editVersion: 1, submissionKey: 'key-session-1' }));
        expect(result.outcome).toBe('ACCEPTED');
        const stored = await requestRow();
        expect(stored).toMatchObject({ is_locked: false, locked_reason: null, locked_at: null });
        expect(new Date(stored.metered_at as string).toISOString()).toBe(METERED_AT);
    });

    it('never removes an existing lock, on any plan', async () => {
        const lockedAt = '2026-09-02T08:00:00.000Z';
        for (const plan of ['free', 'pro']) {
            await seedRequest({ is_locked: true, locked_reason: 'monthly_limit', locked_at: lockedAt, metered_at: METERED_AT });
            await setPlans(plan, 'free');
            expect((await submitSellerRequest(submission())).outcome).toBe('ACCEPTED');
            const stored = await requestRow();
            expect(stored).toMatchObject({ is_locked: true, locked_reason: 'monthly_limit' });
            expect(new Date(stored.locked_at as string).toISOString()).toBe(lockedAt);
            expect(new Date(stored.metered_at as string).toISOString()).toBe(METERED_AT);
        }
    });

    it('never meters or locks a test-drive request, whatever the caller says', async () => {
        await seedOthers(5);
        for (const isTestDrive of [true, false]) {
            await db.query('DELETE FROM requests WHERE id = $1', [REQUEST]);
            await seedRequest({ is_demo: true }, { keep: true });
            await submitSellerRequest(submission({ isTestDrive }));
            expect(await lockState()).toEqual({ is_locked: false, locked_reason: null, metered: false, locked_at: false });
        }
    });

    it('writes no lock for a refused submission', async () => {
        await seedOthers(5);
        expect((await submitSellerRequest(submission({ editVersion: 4 }))).outcome).toBe('STALE_SESSION');
        expect(await requestRow()).toMatchObject({ is_locked: false, metered_at: null, status: 'in_progress' });
    });
});

describe('reopen and editing sessions', () => {
    beforeEach(async () => {
        await submitSellerRequest(submission());
        await db.query('UPDATE requests SET metered_at = $2 WHERE id = $1', [REQUEST, METERED_AT]);
    });

    it('reopens a submitted request without touching answers, metering, address or ownership', async () => {
        const result = await reopenSubmittedRequest({ executor: exec, requestId: REQUEST, ...actor });

        expect(result).toMatchObject({ outcome: 'OK', currentEditVersion: 1 });
        const stored = await requestRow();
        expect(stored).toMatchObject({
            status: 'in_progress',
            seller_edit_version: 1,
            seller_submission_key: null,
            property_address: ADDRESS,
            account_id: OWNER,
            organization_id: ORG,
            water_source: 'city',
            is_locked: false,
        });
        expect(new Date(stored.metered_at as string).toISOString()).toBe(METERED_AT);
        expect((await entries()).map((row) => row.display_name)).toEqual(['First Power', 'First Water']);
        expect(await events('request_reopened')).toBe(1);
    });

    it('refuses a tab from the earlier session after a reopen', async () => {
        await reopenSubmittedRequest({ executor: exec, requestId: REQUEST, ...actor });
        const stale = await submitSellerRequest(submission({
            editVersion: 0,
            submissionKey: 'stale-tab',
            waterSource: 'not_sure',
            entries: [entry('electric', null)],
        }));

        expect(stale).toMatchObject({ outcome: 'STALE_SESSION', currentEditVersion: 1 });
        expect(await requestRow()).toMatchObject({ status: 'in_progress', water_source: 'city' });
        expect((await entries()).map((row) => row.display_name)).toEqual(['First Power', 'First Water']);
    });

    it('does not accept the earlier session key as a duplicate after a reopen', async () => {
        await reopenSubmittedRequest({ executor: exec, requestId: REQUEST, ...actor });
        // The first session's response was lost; its retry arrives after the reopen.
        expect((await submitSellerRequest(submission({ editVersion: 0 }))).outcome).toBe('STALE_SESSION');

        await submitSellerRequest(submission({ editVersion: 1, submissionKey: 'key-session-1' }));
        // Old key, old session, request submitted again: still not a duplicate.
        expect((await submitSellerRequest(submission({ editVersion: 0 }))).outcome).toBe('ALREADY_SUBMITTED');
        // Old key replayed against the new session number: not a duplicate either.
        expect((await submitSellerRequest(submission({ editVersion: 1 }))).outcome).toBe('ALREADY_SUBMITTED');
        // The new session's own key is.
        expect((await submitSellerRequest(submission({ editVersion: 1, submissionKey: 'key-session-1' }))).outcome).toBe('DUPLICATE');
    });

    it('keeps metering, ownership and the address through repeated reopen and resubmit cycles', async () => {
        for (let version = 1; version <= 3; version += 1) {
            expect((await reopenSubmittedRequest({ executor: exec, requestId: REQUEST, ...actor })).currentEditVersion).toBe(version);
            const result = await submitSellerRequest(submission({
                editVersion: version,
                submissionKey: `key-session-${version}`,
                entries: [entry('electric', `Power ${version}`, { contact_phone: '555-0100', meter_number: `M-${version}` })],
            }));
            expect(result.outcome).toBe('ACCEPTED');
            // Every earlier session is refused.
            expect((await submitSellerRequest(submission({ editVersion: version - 1, submissionKey: 'old' }))).outcome).toBe('ALREADY_SUBMITTED');
        }

        const stored = await requestRow();
        expect(stored).toMatchObject({
            status: 'submitted',
            seller_edit_version: 3,
            property_address: ADDRESS,
            account_id: OWNER,
            organization_id: ORG,
            is_locked: false,
        });
        expect(new Date(stored.metered_at as string).toISOString()).toBe(METERED_AT);
        expect(await entries()).toEqual([
            expect.objectContaining({ category: 'electric', display_name: 'Power 3', contact_phone: '555-0100', meter_number: 'M-3' }),
        ]);
        expect(await events('seller_submitted')).toBe(4);
        expect(await events('request_reopened')).toBe(3);
        const usage = await one(
            'SELECT COUNT(*)::int AS n FROM requests WHERE account_id = $1 AND metered_at IS NOT NULL',
            [OWNER]
        );
        expect(Number(usage.n)).toBe(1);
    });

    it('refuses to reopen a locked, test-drive, deleted or unsubmitted request', async () => {
        await db.query("UPDATE requests SET is_locked = TRUE, locked_reason = 'monthly_limit' WHERE id = $1", [REQUEST]);
        expect((await reopenSubmittedRequest({ executor: exec, requestId: REQUEST, ...actor })).outcome).toBe('LOCKED');
        expect(await requestRow()).toMatchObject({ status: 'submitted', is_locked: true, seller_edit_version: 0 });

        await db.query('UPDATE requests SET is_locked = FALSE, is_demo = TRUE WHERE id = $1', [REQUEST]);
        expect((await reopenSubmittedRequest({ executor: exec, requestId: REQUEST, ...actor })).outcome).toBe('TEST_REQUEST');

        await db.query("UPDATE requests SET is_demo = FALSE, status = 'sent' WHERE id = $1", [REQUEST]);
        expect((await reopenSubmittedRequest({ executor: exec, requestId: REQUEST, ...actor })).outcome).toBe('NOT_SUBMITTED');

        await db.query("UPDATE requests SET status = 'submitted', deleted_at = NOW() WHERE id = $1", [REQUEST]);
        expect((await reopenSubmittedRequest({ executor: exec, requestId: REQUEST, ...actor })).outcome).toBe('NOT_FOUND');
        expect(await events('request_reopened')).toBe(0);
    });

    it('reopens only once when asked twice', async () => {
        await reopenSubmittedRequest({ executor: exec, requestId: REQUEST, ...actor });
        const second = await reopenSubmittedRequest({ executor: exec, requestId: REQUEST, ...actor });
        expect(second).toMatchObject({ outcome: 'NOT_SUBMITTED', currentEditVersion: 1 });
        expect(await events('request_reopened')).toBe(1);
    });

    it('closes a reopened request without changes and shuts out the reopened session', async () => {
        await reopenSubmittedRequest({ executor: exec, requestId: REQUEST, ...actor });
        const closed = await cancelRequestReopen({ executor: exec, requestId: REQUEST, ...actor });

        expect(closed).toMatchObject({ outcome: 'OK', currentEditVersion: 2 });
        expect(await requestRow()).toMatchObject({ status: 'submitted', water_source: 'city', seller_edit_version: 2 });
        expect((await entries()).map((row) => row.display_name)).toEqual(['First Power', 'First Water']);
        expect(await events('request_reopen_cancelled')).toBe(1);

        // A seller tab left open from the reopened session.
        expect((await submitSellerRequest(submission({ editVersion: 1, submissionKey: 'late' }))).outcome).toBe('ALREADY_SUBMITTED');
        // After another reopen that same tab is still from an old session.
        await reopenSubmittedRequest({ executor: exec, requestId: REQUEST, ...actor });
        expect((await submitSellerRequest(submission({ editVersion: 1, submissionKey: 'late' }))).outcome).toBe('STALE_SESSION');
    });

    it('cannot use close-without-changes to mark a never-submitted request as submitted', async () => {
        await seedRequest({ status: 'in_progress' });
        const result = await cancelRequestReopen({ executor: exec, requestId: REQUEST, ...actor });
        expect(result.outcome).toBe('NOT_REOPENED');
        expect((await requestRow()).status).toBe('in_progress');

        await seedRequest({ status: 'submitted' });
        expect((await cancelRequestReopen({ executor: exec, requestId: REQUEST, ...actor })).outcome).toBe('NOT_REOPENED');
    });
});
