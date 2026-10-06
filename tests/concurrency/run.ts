/**
 * Lock and claim behaviour under genuinely concurrent PostgreSQL connections.
 *
 * PGlite (used by the Vitest suites) is one connection and cannot show how two
 * sessions interleave. This script starts a disposable local PostgreSQL server,
 * loads schema.sql and the new migrations, and runs the production SQL from
 * lib/neon/queries over separate connections.
 *
 * It only ever talks to the server it starts itself on 127.0.0.1 in a temporary
 * directory. It reads no DATABASE_URL and cannot reach a live database.
 *
 * Usage: see tests/concurrency/README.md.
 */
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { SqlRow, SqlStatement, StatementExecutor } from '@/lib/neon/statements';
import {
    accountRoleChangeStatement,
    changeAccountPlan,
    changeAccountRole,
    correctRequestStatus,
    updateRequestSellerContact,
} from '@/lib/neon/queries/admin-writes';
import { claimReminderOperation, reminderClaimStatements } from '@/lib/neon/queries/reminder-operations';
import { applyTriageAction } from '@/lib/ops/triage';
import {
    cancelRequestReopen,
    reopenSubmittedRequest,
    sellerSubmissionStatements,
    submitSellerRequest,
    type SubmitSellerRequestInput,
} from '@/lib/neon/queries/seller-submission';
import { createEmptyHoaAnswers } from '@/lib/packet/hoa';

const modulesDir = process.env.PG_HARNESS_MODULES;
if (!modulesDir) {
    console.error('Set PG_HARNESS_MODULES to a node_modules directory containing embedded-postgres and pg.');
    process.exit(2);
}
const harnessRequire = createRequire(path.join(modulesDir, 'noop.js'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EmbeddedPostgres: any = harnessRequire('embedded-postgres').default ?? harnessRequire('embedded-postgres');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Client }: any = harnessRequire('pg');

const PORT = 54000 + Math.floor(Math.random() * 900);
const ADMIN_A = '00000000-0000-4000-8000-0000000000a1';
const ADMIN_B = '00000000-0000-4000-8000-0000000000a2';
const USER = '00000000-0000-4000-8000-0000000000b1';
const REQ = '00000000-0000-4000-8000-0000000000d1';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PgClient = any;

async function connect(): Promise<PgClient> {
    const client = new Client({ host: '127.0.0.1', port: PORT, user: 'postgres', password: 'local-harness', database: 'postgres' });
    await client.connect();
    return client;
}

/** One connection per executor, exactly like one Neon HTTP request per call. */
function executorFor(client: PgClient): StatementExecutor {
    return {
        async run(statement: SqlStatement) {
            return (await client.query(statement.text, statement.params)).rows as SqlRow[];
        },
        async transaction(statements: SqlStatement[]) {
            await client.query('BEGIN');
            try {
                const results: SqlRow[][] = [];
                for (const statement of statements) {
                    results.push((await client.query(statement.text, statement.params)).rows);
                }
                await client.query('COMMIT');
                return results;
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            }
        },
    };
}

let failures = 0;
function check(name: string, condition: boolean, detail: unknown = '') {
    if (!condition) failures += 1;
    console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${condition ? '' : `  ${JSON.stringify(detail)}`}`);
}

async function main() {
    const dataDir = mkdtempSync(path.join(tmpdir(), 'utilitysheet-pg-'));
    const server = new EmbeddedPostgres({
        databaseDir: dataDir, user: 'postgres', password: 'local-harness', port: PORT, persistent: false,
    });
    await server.initialise();
    await server.start();

    const clients: PgClient[] = [];
    try {
        const setup = await connect();
        clients.push(setup);
        await setup.query(readFileSync('schema.sql', 'utf8'));
        // schema.sql mirrors the new migrations; re-applying each one also proves it is idempotent.
        for (const migration of ['migrations-reminder-operations.sql', 'migrations-operational-events.sql', 'migrations-admin-triage.sql', 'migrations-seller-edit-sessions.sql']) {
            await setup.query(readFileSync(migration, 'utf8'));
        }

        const a = await connect();
        const b = await connect();
        clients.push(a, b);
        const dbA = executorFor(a);
        const dbB = executorFor(b);
        const actor = (adminId: string) => ({ adminId, ipAddress: null, userAgent: null });

        const reset = async () => {
            await setup.query(`
                TRUNCATE admin_triage_items, reminder_operations, admin_audit_logs, event_logs, requests, accounts CASCADE;
                INSERT INTO accounts (id, email, role) VALUES
                    ('${ADMIN_A}', 'a@example.com', 'admin'), ('${ADMIN_B}', 'b@example.com', 'admin'),
                    ('${USER}', 'user@example.com', 'user');
                INSERT INTO requests (id, account_id, property_address, seller_email, status, public_token, seller_token)
                    VALUES ('${REQ}', '${USER}', '1 Open St', 'sam@example.com', 'sent', 'pub1', 'sel1');
            `);
        };
        const scalar = async (text: string) => Number((await setup.query(text)).rows[0].n);
        const adminCount = () => scalar(`SELECT COUNT(*)::int AS n FROM accounts WHERE role = 'admin'`);

        // 1. Two admins demote each other at the same time, many times.
        let alwaysOneAdmin = true;
        let alwaysOneWinner = true;
        for (let i = 0; i < 25; i += 1) {
            await reset();
            const demote = (db: StatementExecutor, by: string, target: string) => changeAccountRole({
                db, actor: actor(by), reason: 'race', targetId: target, nextRole: 'user', expectedRole: 'admin', action: 'role_changed',
            });
            const outcomes = (await Promise.all([demote(dbA, ADMIN_A, ADMIN_B), demote(dbB, ADMIN_B, ADMIN_A)])).map((r) => r.outcome);
            if (await adminCount() !== 1) alwaysOneAdmin = false;
            if (outcomes.filter((o) => o === 'OK').length !== 1 || !outcomes.includes('ACTOR_NOT_ADMIN')) alwaysOneWinner = false;
        }
        check('mutual admin demotion always leaves exactly one admin (25 races)', alwaysOneAdmin);
        check('mutual admin demotion: one OK, the other refused as no longer admin', alwaysOneWinner);

        // 2. Deterministic interleaving: B must wait for A's uncommitted change, then see it.
        await reset();
        await a.query('BEGIN');
        await a.query(`SELECT pg_advisory_xact_lock(hashtextextended('utilitysheet:admin-role-change', 0))`);
        const stmtA = accountRoleChangeStatement({
            actor: actor(ADMIN_A), reason: 'held', targetId: ADMIN_B, nextRole: 'user', expectedRole: 'admin', action: 'role_changed',
        });
        await a.query(stmtA.text, stmtA.params);
        let bSettled = false;
        const bPromise = changeAccountRole({
            db: dbB, actor: actor(ADMIN_B), reason: 'waiting', targetId: ADMIN_A, nextRole: 'user', expectedRole: 'admin', action: 'role_changed',
        }).then((result) => { bSettled = true; return result; });
        await new Promise((resolve) => setTimeout(resolve, 400));
        check('second role change blocks while the first transaction is open', bSettled === false);
        await a.query('COMMIT');
        check('after the first commits, the waiting change is refused', (await bPromise).outcome === 'ACTOR_NOT_ADMIN');
        check('exactly one admin remains after the held interleaving', await adminCount() === 1);

        // 3. Parallel stale edits: one writer wins, the other is told the record changed.
        let editsOk = true;
        for (let i = 0; i < 15; i += 1) {
            await reset();
            const expected = { sellerName: null, sellerEmail: 'sam@example.com', sellerPhone: null };
            const edit = (db: StatementExecutor, phone: string) => updateRequestSellerContact({
                db, actor: actor(ADMIN_A), reason: 'race', requestId: REQ, seller: { ...expected, sellerPhone: phone }, expected,
            });
            const outcomes = (await Promise.all([edit(dbA, '111'), edit(dbB, '222')])).map((r) => r.outcome).sort();
            if (outcomes.join() !== 'OK,STALE') editsOk = false;
            if (await scalar(`SELECT COUNT(*)::int AS n FROM admin_audit_logs`) !== 1) editsOk = false;
        }
        check('parallel seller edits: one OK, one STALE, one audit entry (15 races)', editsOk);

        let statusOk = true;
        let planOk = true;
        for (let i = 0; i < 15; i += 1) {
            await reset();
            const correct = (db: StatementExecutor, next: 'draft' | 'in_progress') => correctRequestStatus({
                db, actor: actor(ADMIN_A), reason: 'race', requestId: REQ, nextStatus: next, expectedStatus: 'sent',
            });
            const s = (await Promise.all([correct(dbA, 'draft'), correct(dbB, 'in_progress')])).map((r) => r.outcome).sort();
            if (s.join() !== 'OK,STALE' || await scalar(`SELECT COUNT(*)::int AS n FROM event_logs`) !== 1) statusOk = false;

            const plan = (db: StatementExecutor) => changeAccountPlan({
                db, actor: actor(ADMIN_A), reason: 'race', targetId: USER, nextPlan: 'pro', expectedPlan: 'free',
            });
            const p = (await Promise.all([plan(dbA), plan(dbB)])).map((r) => r.outcome).sort();
            if (p.join() !== 'OK,STALE') planOk = false;
        }
        check('parallel status corrections: one OK, one STALE, one timeline event (15 races)', statusOk);
        check('parallel entitlement overrides: one OK, one STALE (15 races)', planOk);

        // 4. Reminder claims from two Admin sessions and from Admin + customer.
        let claimsOk = true;
        for (let i = 0; i < 25; i += 1) {
            await reset();
            const claim = (db: StatementExecutor, id: string, admin: boolean) => claimReminderOperation({
                db, operationId: id, requestId: REQ, recipientEmail: 'sam@example.com', payloadFingerprint: 'a'.repeat(64),
                actor: admin
                    ? { type: 'admin', admin: actor(ADMIN_A), reason: 'race' }
                    : { type: 'agent', accountId: USER, ipAddress: null, userAgent: null },
            });
            const outcomes = (await Promise.all([claim(dbA, uuid(1000 + i), true), claim(dbB, uuid(2000 + i), i % 2 === 0)]))
                .map((r) => r.outcome).sort();
            if (outcomes.join() !== 'CLAIMED,IN_FLIGHT') claimsOk = false;
            if (await scalar(`SELECT COUNT(*)::int AS n FROM reminder_operations WHERE state = 'pending'`) !== 1) claimsOk = false;
        }
        check('concurrent reminder claims: exactly one CLAIMED, the other IN_FLIGHT (25 races)', claimsOk);

        // 5. Held interleaving for the claim: the waiter sees the committed claim, not a stale snapshot.
        await reset();
        const held = reminderClaimStatements({
            operationId: uuid(3001), requestId: REQ, recipientEmail: 'sam@example.com', payloadFingerprint: 'a'.repeat(64),
            actor: { type: 'admin', admin: actor(ADMIN_A), reason: 'held' },
        });
        await a.query('BEGIN');
        for (const statement of held) await a.query(statement.text, statement.params);
        let claimSettled = false;
        const waiting = claimReminderOperation({
            db: dbB, operationId: uuid(3002), requestId: REQ, recipientEmail: 'sam@example.com', payloadFingerprint: 'a'.repeat(64),
            actor: { type: 'agent', accountId: USER, ipAddress: null, userAgent: null },
        }).then((result) => { claimSettled = true; return result; });
        await new Promise((resolve) => setTimeout(resolve, 400));
        check('second reminder claim blocks while the first is uncommitted', claimSettled === false);
        await a.query('COMMIT');
        const waited = await waiting;
        check('after commit the waiting claim is IN_FLIGHT and points at the first operation',
            waited.outcome === 'IN_FLIGHT' && waited.blockingOperationId === uuid(3001), waited);

        // 6. Two operators triage the same item at once: one wins, the other is told to refresh.
        let triageOk = true;
        for (let i = 0; i < 15; i += 1) {
            await reset();
            const triage = (db: StatementExecutor, by: string, action: 'acknowledge' | 'resolve') => applyTriageAction({
                db, actor: actor(by), sourceKey: 'incident:pdf:generation_failed', kind: 'service', action,
                expectedVersion: 0, snoozedUntil: null, note: null, reason: 'race',
            });
            const outcomes = (await Promise.all([triage(dbA, ADMIN_A, 'acknowledge'), triage(dbB, ADMIN_B, 'resolve')]))
                .map((r) => r.outcome).sort();
            if (outcomes.join() !== 'OK,STALE') triageOk = false;
            if (await scalar(`SELECT COUNT(*)::int AS n FROM admin_audit_logs WHERE action = 'triage_updated'`) !== 1) triageOk = false;
        }
        check('concurrent triage of one item: one OK, one STALE, one audit entry (15 races)', triageOk);

        // 7. Seller submission and coordinator reopen (lib/neon/queries/seller-submission.ts).
        const submission = (db: StatementExecutor, provider: string, overrides: Partial<SubmitSellerRequestInput> = {}) => submitSellerRequest({
            executor: db, requestId: REQ, editVersion: 0, submissionKey: `key-${provider}`,
            waterSource: 'city', sewerType: 'public', heatingType: null, updateHoa: false, hoa: createEmptyHoaAnswers(),
            advancedPacketData: {},
            entries: [{
                category: 'electric', entry_mode: 'free_text', display_name: provider, raw_text: provider, canonical_id: null,
                confidence_score: null, contact_phone: null, contact_url: null, meter_number: null, extra: {},
            }],
            isTestDrive: false, eventData: { actor: 'seller' }, ipAddress: null, userAgent: null,
            ...overrides,
        });
        const reopenActor = { requestId: REQ, actorAccountId: USER, ipAddress: null, userAgent: null };
        const text = async (query: string) => String((await setup.query(query)).rows[0]?.v ?? '');
        const providers = () => text(`SELECT string_agg(display_name, ',' ORDER BY display_name) AS v FROM utility_entries WHERE request_id = '${REQ}'`);
        const submittedEvents = () => scalar(`SELECT COUNT(*)::int AS n FROM event_logs WHERE request_id = '${REQ}' AND event_type = 'seller_submitted'`);

        // 7a. Two different submissions at once: one sheet, one event, never a mix.
        let submitOk = true;
        for (let i = 0; i < 25; i += 1) {
            await reset();
            const results = await Promise.all([submission(dbA, 'Power A'), submission(dbB, 'Power B')]);
            const outcomes = results.map((r) => r.outcome).sort();
            const winner = results[0].outcome === 'ACCEPTED' ? 'Power A' : 'Power B';
            if (outcomes.join() !== 'ACCEPTED,ALREADY_SUBMITTED') submitOk = false;
            if (await providers() !== winner) submitOk = false;
            if (await submittedEvents() !== 1) submitOk = false;
        }
        check('simultaneous submissions: one ACCEPTED, one ALREADY_SUBMITTED, one sheet and event (25 races)', submitOk);

        // 7b. The same submission sent twice at once (double tap, or an early retry).
        let duplicateOk = true;
        for (let i = 0; i < 25; i += 1) {
            await reset();
            const outcomes = (await Promise.all([
                submission(dbA, 'Power A', { submissionKey: 'same-key' }),
                submission(dbB, 'Power A', { submissionKey: 'same-key' }),
            ])).map((r) => r.outcome).sort();
            if (outcomes.join() !== 'ACCEPTED,DUPLICATE') duplicateOk = false;
            if (await submittedEvents() !== 1) duplicateOk = false;
        }
        check('same key twice at once: one ACCEPTED, one DUPLICATE, one event (25 races)', duplicateOk);

        // 7c. A tab from the first session submits while a reopen is still uncommitted.
        await reset();
        await submission(dbA, 'Stored Power');
        await a.query('BEGIN');
        await reopenSubmittedRequest({ executor: dbA, ...reopenActor });
        let staleSettled = false;
        const staleTab = submission(dbB, 'Stale Tab Power', { submissionKey: 'stale-tab' })
            .then((result) => { staleSettled = true; return result; });
        await new Promise((resolve) => setTimeout(resolve, 400));
        check('old-session submission waits while a reopen is uncommitted', staleSettled === false);
        await a.query('COMMIT');
        const staleResult = await staleTab;
        check('after the reopen commits, the old-session submission is refused as STALE_SESSION',
            staleResult.outcome === 'STALE_SESSION', staleResult);
        check('the reopened sheet is untouched by the old-session tab',
            await providers() === 'Stored Power' && await text(`SELECT status AS v FROM requests WHERE id = '${REQ}'`) === 'in_progress');

        // 7d. The first session's lost-response retry arrives during the reopen.
        await reset();
        await submission(dbA, 'Stored Power', { submissionKey: 'lost-response' });
        await a.query('BEGIN');
        await reopenSubmittedRequest({ executor: dbA, ...reopenActor });
        const lateRetry = submission(dbB, 'Stored Power', { submissionKey: 'lost-response' });
        await new Promise((resolve) => setTimeout(resolve, 300));
        await a.query('COMMIT');
        check('a retry key from the earlier session is not a duplicate once reopened',
            (await lateRetry).outcome === 'STALE_SESSION');

        // 7e. Reopen racing a second reopen, and a current-session submission racing close-without-changes.
        let reopenOk = true;
        for (let i = 0; i < 15; i += 1) {
            await reset();
            await submission(dbA, 'Stored Power');
            const outcomes = (await Promise.all([
                reopenSubmittedRequest({ executor: dbA, ...reopenActor }),
                reopenSubmittedRequest({ executor: dbB, ...reopenActor }),
            ])).map((r) => r.outcome).sort();
            if (outcomes.join() !== 'NOT_SUBMITTED,OK') reopenOk = false;
            if (await scalar(`SELECT seller_edit_version AS n FROM requests WHERE id = '${REQ}'`) !== 1) reopenOk = false;
        }
        check('two reopens at once: one OK, one refused, one new session (15 races)', reopenOk);

        let closeOk = true;
        for (let i = 0; i < 25; i += 1) {
            await reset();
            await submission(dbA, 'Stored Power');
            await reopenSubmittedRequest({ executor: dbA, ...reopenActor });
            const [submitted, closed] = await Promise.all([
                submission(dbA, 'Resubmitted Power', { editVersion: 1, submissionKey: 'session-1' }),
                cancelRequestReopen({ executor: dbB, ...reopenActor }),
            ]);
            const sheet = await providers();
            const sellerWon = submitted.outcome === 'ACCEPTED' && closed.outcome === 'NOT_REOPENED' && sheet === 'Resubmitted Power';
            const closeWon = submitted.outcome === 'ALREADY_SUBMITTED' && closed.outcome === 'OK' && sheet === 'Stored Power';
            if (!sellerWon && !closeWon) closeOk = false;
            if (await text(`SELECT status AS v FROM requests WHERE id = '${REQ}'`) !== 'submitted') closeOk = false;
        }
        check('resubmission racing close-without-changes: exactly one takes effect (25 races)', closeOk);

        // 8. Free monthly limit across different requests of one owner.
        const USER_2 = '00000000-0000-4000-8000-0000000000b2';
        const FREE_REQ = (n: number) => uuid(8000 + n);
        const OTHER_REQ = uuid(8100);
        const c = await connect();
        const d = await connect();
        clients.push(c, d);
        const dbC = executorFor(c);
        const dbD = executorFor(d);
        /** `counted` earlier submissions this month, plus four open requests for USER and one for USER_2. */
        const resetUsage = async (counted: number, plan = 'free') => {
            await reset();
            await setup.query(`
                UPDATE accounts SET subscription_status = '${plan}' WHERE id = '${USER}';
                INSERT INTO accounts (id, email, role) VALUES ('${USER_2}', 'user2@example.com', 'user');
                INSERT INTO requests (id, account_id, property_address, status, public_token, seller_token)
                    SELECT ('00000000-0000-4000-8000-' || lpad((8000 + n)::text, 12, '0'))::uuid, '${USER}', n || ' Free St', 'sent', 'fpub' || n, 'fsel' || n
                    FROM generate_series(1, 4) AS n;
                INSERT INTO requests (id, account_id, property_address, status, public_token, seller_token)
                    VALUES ('${OTHER_REQ}', '${USER_2}', '1 Other St', 'sent', 'opub', 'osel');
                INSERT INTO requests (account_id, property_address, status, public_token, seller_token, metered_at)
                    SELECT '${USER}', n || ' Earlier St', 'submitted', 'epub' || n, 'esel' || n, NOW()
                    FROM generate_series(1, ${counted}) AS n;
            `);
        };
        const first = (db: StatementExecutor, n: number) => submission(db, `Power ${n}`, { requestId: FREE_REQ(n) });
        const unlockedCount = () => scalar(`SELECT COUNT(*)::int AS n FROM requests WHERE id IN ('${FREE_REQ(1)}','${FREE_REQ(2)}','${FREE_REQ(3)}','${FREE_REQ(4)}') AND metered_at IS NOT NULL AND is_locked = FALSE`);
        const lockedCount = () => scalar(`SELECT COUNT(*)::int AS n FROM requests WHERE account_id = '${USER}' AND metered_at IS NOT NULL AND is_locked AND locked_reason = 'monthly_limit'`);
        const heldInput = (n: number) => ({
            requestId: FREE_REQ(n), editVersion: 0, submissionKey: `held-${n}`, waterSource: 'city', sewerType: 'public', heatingType: null,
            updateHoa: false, hoa: createEmptyHoaAnswers(), advancedPacketData: {}, entries: [], isTestDrive: false,
            eventData: { actor: 'seller' }, ipAddress: null, userAgent: null,
        });

        // 8a. What the lock is for: the same statement without it lets a second
        // submission through while the first is uncommitted, and both stay unlocked.
        await resetUsage(2);
        const [, withoutLockA] = sellerSubmissionStatements(heldInput(1));
        const [, withoutLockB] = sellerSubmissionStatements(heldInput(2));
        await a.query('BEGIN');
        await a.query(withoutLockA.text, withoutLockA.params);
        await b.query(withoutLockB.text, withoutLockB.params);
        await a.query('COMMIT');
        check('without the advisory lock the count alone lets two submissions past one remaining slot (the race)',
            await unlockedCount() === 2 && await lockedCount() === 0);

        // 8b. With it: one slot left, two different requests at once.
        let limitOk = true;
        for (let i = 0; i < 25; i += 1) {
            await resetUsage(2);
            const outcomes = (await Promise.all([first(dbA, 1), first(dbB, 2)])).map((r) => r.outcome);
            if (outcomes.join() !== 'ACCEPTED,ACCEPTED') limitOk = false;
            if (await unlockedCount() !== 1 || await lockedCount() !== 1) limitOk = false;
        }
        check('one slot left, two requests at once: both stored, exactly one unlocked and one locked (25 races)', limitOk);

        // 8c. Held interleaving: the second waits, then counts the first's committed submission.
        await resetUsage(2);
        await a.query('BEGIN');
        for (const statement of sellerSubmissionStatements(heldInput(1))) await a.query(statement.text, statement.params);
        let secondSettled = false;
        const second = first(dbB, 2).then((result) => { secondSettled = true; return result; });
        // 8d. A different owner is not held up by it.
        const otherOwner = await submission(dbC, 'Other Power', { requestId: OTHER_REQ });
        await new Promise((resolve) => setTimeout(resolve, 400));
        check('second submission for the same owner waits while the first is uncommitted', secondSettled === false);
        check('a different owner submits without waiting, unlocked',
            otherOwner.outcome === 'ACCEPTED' && (otherOwner.request as { is_locked?: boolean } | null)?.is_locked === false, otherOwner.outcome);
        await a.query('COMMIT');
        const secondResult = await second;
        check('after the first commits, the waiting submission is stored locked',
            secondResult.outcome === 'ACCEPTED' && (secondResult.request as { is_locked?: boolean } | null)?.is_locked === true
            && await unlockedCount() === 1, secondResult.outcome);

        // 8e. Four at once from nothing used: three unlocked, never more.
        let burstOk = true;
        for (let i = 0; i < 25; i += 1) {
            await resetUsage(0);
            const outcomes = (await Promise.all([first(dbA, 1), first(dbB, 2), first(dbC, 3), first(dbD, 4)])).map((r) => r.outcome);
            if (outcomes.some((o) => o !== 'ACCEPTED')) burstOk = false;
            if (await unlockedCount() !== 3 || await lockedCount() !== 1) burstOk = false;
        }
        check('four requests at once from zero used: exactly three unlocked, one locked (25 races)', burstOk);

        // 8f. A paid owner is never locked, however many arrive together.
        let paidOk = true;
        for (let i = 0; i < 10; i += 1) {
            await resetUsage(5, 'pro');
            await Promise.all([first(dbA, 1), first(dbB, 2), first(dbC, 3), first(dbD, 4)]);
            if (await unlockedCount() !== 4 || await lockedCount() !== 0) paidOk = false;
        }
        check('Pro owner over the count, four at once: none locked (10 races)', paidOk);

        // 8g. A resubmission after a reopen races a first submission with the limit reached.
        let resubmitOk = true;
        for (let i = 0; i < 15; i += 1) {
            await resetUsage(3);
            await setup.query(`UPDATE requests SET status = 'in_progress', seller_edit_version = 1, metered_at = '2026-01-15T12:00:00Z' WHERE id = '${FREE_REQ(1)}'`);
            const [again, fresh] = await Promise.all([
                submission(dbA, 'Corrected Power', { requestId: FREE_REQ(1), editVersion: 1, submissionKey: 'session-1' }),
                first(dbB, 2),
            ]);
            if (again.outcome !== 'ACCEPTED' || fresh.outcome !== 'ACCEPTED') resubmitOk = false;
            const kept = await text(`SELECT (is_locked = FALSE AND metered_at = '2026-01-15T12:00:00Z')::text AS v FROM requests WHERE id = '${FREE_REQ(1)}'`);
            const freshLocked = await text(`SELECT is_locked::text AS v FROM requests WHERE id = '${FREE_REQ(2)}'`);
            if (kept !== 'true' || freshLocked !== 'true') resubmitOk = false;
        }
        check('resubmission racing a first submission at the limit: resubmission unlocked with its original metering, the new one locked (15 races)', resubmitOk);
    } finally {
        for (const client of clients) await client.end().catch(() => undefined);
        await server.stop().catch(() => undefined);
        rmSync(dataDir, { recursive: true, force: true });
    }

    console.log(failures === 0 ? '\nAll concurrency checks passed.' : `\n${failures} concurrency check(s) FAILED.`);
    process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
