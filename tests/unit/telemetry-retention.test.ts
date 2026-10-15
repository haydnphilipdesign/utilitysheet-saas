// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSchemaDatabase, pgliteExecutor, queryRows } from '../helpers/pglite-db';

import type { StatementExecutor } from '@/lib/neon/statements';
import {
    RETENTION_CLASS_KEYS,
    getRetentionStatus,
    parseRetentionMode,
    resolveRetentionPlan,
    runRetention,
    runScheduledRetention,
} from '@/lib/telemetry/retention';

// Real schema.sql in disposable embedded PostgreSQL; no environment or credentials are read.
const OWNER = '00000000-0000-4000-8000-0000000000a1';
const ADMIN = '00000000-0000-4000-8000-0000000000a2';
const REFERRED = '00000000-0000-4000-8000-0000000000a3';
const REQ = '00000000-0000-4000-8000-0000000000b1';
const SOFT_DELETED = '00000000-0000-4000-8000-0000000000b2';
const OLD = 4000; // days: older than every window

let db: PGlite;
let exec: StatementExecutor;
const rows = (text: string, params: unknown[] = []) => queryRows(db, text, params);
const count = async (text: string) => Number((await rows(text))[0].n);
const ENFORCE_ALL = { TELEMETRY_RETENTION_MODE: 'enforce', TELEMETRY_RETENTION_HISTORICAL_CLEANUP: 'true' };

async function event(type: string, ageDays: number | null, data: Record<string, unknown> = {}, ip: string | null = '198.51.100.7', request = REQ) {
    const at = ageDays === null ? 'NULL' : `NOW() - make_interval(days => ${ageDays})`;
    await db.query(
        `INSERT INTO event_logs (request_id, event_type, event_data, ip_address, user_agent, created_at) VALUES ($1, $2, $3::jsonb, $4, $5, ${at})`,
        [request, type, JSON.stringify(data), ip, ip ? 'Mozilla/5.0 (iPhone)' : null],
    );
}

/** Ages in minutes relative to a window, to test the cutoff from both sides. */
async function eventMinutes(type: string, minutes: number) {
    await db.query(`INSERT INTO event_logs (request_id, event_type, event_data, created_at) VALUES ($1, $2, '{}'::jsonb, NOW() - make_interval(mins => ${minutes}))`, [REQ, type]);
}

async function aiRun(ageDays: number, request: string | null = REQ) {
    const [run] = (await db.query<{ id: string }>(
        `INSERT INTO ai_generation_runs (request_id, feature, prompt_version, status, created_at)
         VALUES ($1, 'provider_suggestions', 'v1', 'success', NOW() - make_interval(days => ${ageDays})) RETURNING id`,
        [request],
    )).rows;
    await db.query(
        `INSERT INTO ai_suggestion_items (run_id, request_id, rank, display_name, normalized_name) VALUES ($1, $2, 1, 'City Power', 'city power'), ($1, $2, 2, 'Town Gas', 'town gas')`,
        [run.id, request],
    );
}

beforeAll(async () => {
    db = await createSchemaDatabase();
    exec = pgliteExecutor(db);
}, 60000);
afterAll(async () => { await db?.close(); });

beforeEach(async () => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await db.exec(`
        TRUNCATE event_logs, ai_generation_runs, ai_suggestion_items, notification_observations, pdf_render_observations,
            operational_events, job_runs, reminder_operations, admin_audit_logs, account_security_events, referral_credits,
            activation_outreach_logs, testimonial_outreach_logs, growth_referral_events, requests, accounts CASCADE;
        INSERT INTO accounts (id, email, role) VALUES
            ('${OWNER}', 'owner@example.com', 'user'), ('${ADMIN}', 'admin@example.com', 'admin'), ('${REFERRED}', 'new@example.com', 'user');
        INSERT INTO requests (id, account_id, property_address, status, public_token, seller_token, metered_at, deleted_at) VALUES
            ('${REQ}', '${OWNER}', '12 Private Rd', 'submitted', 'pub1', 'sel1', NOW(), NULL),
            ('${SOFT_DELETED}', '${OWNER}', '9 Gone Ln', 'submitted', 'pub2', 'sel2', NOW(), NOW());
    `);
});

describe('configuration', () => {
    it('is off unless explicitly set to preview or enforce', () => {
        expect(parseRetentionMode(undefined)).toBe('off');
        expect(parseRetentionMode('')).toBe('off');
        expect(parseRetentionMode('true')).toBe('off');
        expect(parseRetentionMode('enforcing')).toBe('off');
        expect(parseRetentionMode(' Preview ')).toBe('preview');
        expect(parseRetentionMode('ENFORCE')).toBe('enforce');

        const off = resolveRetentionPlan({});
        expect(off.mode).toBe('off');
        expect(off.items.every((item) => item.action === 'skip')).toBe(true);
        expect(off.items.map((item) => item.key)).toEqual([...RETENTION_CLASS_KEYS]);
    });

    it('keeps the existing operations switch and window, and holds historical cleanup to preview without its own switch', () => {
        const actions = (env: Record<string, string>) => Object.fromEntries(resolveRetentionPlan(env).items.map((item) => [item.key, item.action]));

        expect(actions({ OPS_RETENTION_PRUNE_ENABLED: 'true' })).toMatchObject({
            operationalEvents: 'enforce', jobRuns: 'enforce', sellerDiagnostics: 'skip', aiRuns: 'skip', historicalIntakeAddresses: 'skip',
        });
        expect(actions({ TELEMETRY_RETENTION_MODE: 'preview' })).toMatchObject({
            operationalEvents: 'preview', sellerDiagnostics: 'preview', historicalSuggestionNames: 'preview',
        });
        expect(actions({ TELEMETRY_RETENTION_MODE: 'preview', OPS_RETENTION_PRUNE_ENABLED: 'true' })).toMatchObject({
            operationalEvents: 'enforce', sellerDiagnostics: 'preview',
        });
        expect(actions({ TELEMETRY_RETENTION_MODE: 'enforce' })).toMatchObject({
            sellerDiagnostics: 'enforce', eventIpUserAgent: 'enforce', historicalIntakeAddresses: 'preview',
        });
        expect(actions({ TELEMETRY_RETENTION_MODE: 'preview', TELEMETRY_RETENTION_HISTORICAL_CLEANUP: 'true' })).toMatchObject({
            historicalIntakeAddresses: 'preview',
        });
        expect(actions(ENFORCE_ALL)).toMatchObject({ historicalIntakeAddresses: 'enforce', historicalSuggestionNames: 'enforce' });

        const windows = (env: Record<string, string>) => Object.fromEntries(resolveRetentionPlan(env).items.map((item) => [item.key, item.windowDays]));
        expect(windows({})).toEqual({
            sellerDiagnostics: 90, endpointObservations: 180, eventIpUserAgent: 30, aiRuns: 365, aiExposures: 365, aiChoices: 365,
            notificationEvidence: 180, pdfEvidence: 180, operationalEvents: 90, jobRuns: 90,
            historicalIntakeAddresses: null, historicalSuggestionNames: null,
        });
        expect(windows({ OPS_EVENT_RETENTION_DAYS: '1' })).toMatchObject({ operationalEvents: 7, jobRuns: 7 });
        expect(windows({ OPS_EVENT_RETENTION_DAYS: '30' })).toMatchObject({ operationalEvents: 30, notificationEvidence: 180 });
    });

    it('runs no query at all when everything is off', async () => {
        const spy: StatementExecutor = { run: vi.fn(), transaction: vi.fn() };
        expect(await runScheduledRetention({ db: spy, env: {} })).toBeNull();
        expect(spy.run).not.toHaveBeenCalled();
        expect(spy.transaction).not.toHaveBeenCalled();
    });
});

describe('preview and enforce', () => {
    async function seedOldAndNew() {
        await event('seller_step_viewed', 91, {}, null);
        await event('seller_step_viewed', 89, {}, null);
        await event('seller_opened', 181);
        await event('seller_opened', 179);
        await event('suggestions_search', 200, { category: 'gas', result_count: 2 }, null);
        await aiRun(366);
        await aiRun(364);
        await aiRun(400, null); // request already deleted
        await db.exec(`
            INSERT INTO notification_observations (operation_id, request_id, purpose, mode, recipient_slot, intended_recipients, send_outcome, created_at) VALUES
                (gen_random_uuid(), '${REQ}', 'completion_notification', 'live', 0, 1, 'accepted', NOW() - INTERVAL '181 days'),
                (gen_random_uuid(), '${REQ}', 'completion_notification', 'live', 0, 1, 'accepted', NOW() - INTERVAL '10 days');
            INSERT INTO pdf_render_observations (request_id, surface, mode, outcome, created_at) VALUES
                ('${REQ}', 'download', 'live', 'rendered', NOW() - INTERVAL '181 days'),
                ('${REQ}', 'download', 'live', 'rendered', NOW() - INTERVAL '10 days');
            INSERT INTO operational_events (category, code, outcome, fingerprint, occurred_at) VALUES
                ('pdf', 'generation_failed', 'failure', 'pdf:generation_failed', NOW() - INTERVAL '91 days'),
                ('pdf', 'generation_failed', 'failure', 'pdf:generation_failed', NOW() - INTERVAL '1 day');
            INSERT INTO job_runs (job_name, status, started_at) VALUES
                ('ops_monitor', 'success', NOW() - INTERVAL '91 days'), ('ops_monitor', 'success', NOW() - INTERVAL '1 hour');
        `);
    }

    it('preview counts what each rule would affect and changes nothing', async () => {
        await seedOldAndNew();
        await event('request_created', 40, { source: 'intake_link', slug: 'my-form', submitted_property_address: '12 Private Rd', utility_categories: ['gas'] });
        await event('suggestions_fetched', 5, { categories: ['gas'], top_results_by_category: { gas: ['Town Gas'] } }, null);

        const before = await rows(`SELECT * FROM event_logs ORDER BY id`);
        const plan = resolveRetentionPlan({ TELEMETRY_RETENTION_MODE: 'preview', TELEMETRY_RETENTION_HISTORICAL_CLEANUP: 'true' });
        const results = await runRetention({ db: exec, items: plan.items });
        const affected = Object.fromEntries(results.map((item) => [item.key, item.affected]));

        expect(results.every((item) => item.action === 'preview' && !item.failed)).toBe(true);
        expect(affected).toEqual({
            sellerDiagnostics: 1, endpointObservations: 2, eventIpUserAgent: 3, aiRuns: 2, aiExposures: 0, aiChoices: 0,
            notificationEvidence: 1, pdfEvidence: 1, operationalEvents: 1, jobRuns: 1,
            historicalIntakeAddresses: 1, historicalSuggestionNames: 1,
        });
        expect(results.find((item) => item.key === 'aiRuns')?.oldest).toBeTruthy();
        expect(await rows(`SELECT * FROM event_logs ORDER BY id`)).toEqual(before);
        expect(await count(`SELECT COUNT(*)::int AS n FROM ai_generation_runs`)).toBe(3);
        expect(await count(`SELECT COUNT(*)::int AS n FROM job_runs`)).toBe(2);
    });

    it('enforce removes only rows older than each window, with AI items going with their run', async () => {
        await seedOldAndNew();
        const results = await runRetention({ db: exec, items: resolveRetentionPlan({ TELEMETRY_RETENTION_MODE: 'enforce' }).items });
        expect(results.every((item) => !item.failed)).toBe(true);

        expect(await rows(`SELECT event_type, (NOW() - created_at) < INTERVAL '180 days' AS recent FROM event_logs ORDER BY event_type`)).toEqual([
            { event_type: 'seller_opened', recent: true },
            { event_type: 'seller_step_viewed', recent: true },
        ]);
        expect(await count(`SELECT COUNT(*)::int AS n FROM ai_generation_runs`)).toBe(1);
        expect(await count(`SELECT COUNT(*)::int AS n FROM ai_suggestion_items`)).toBe(2);
        for (const table of ['notification_observations', 'pdf_render_observations', 'operational_events', 'job_runs']) {
            expect(await count(`SELECT COUNT(*)::int AS n FROM ${table}`)).toBe(1);
        }
    });

    it('treats the cutoff strictly and keeps rows without a timestamp', async () => {
        const window = 90 * 24 * 60;
        await eventMinutes('seller_step_completed', window + 1);
        await eventMinutes('seller_step_completed', window - 1);
        await event('seller_step_completed', null, {}, null);

        await runRetention({ db: exec, items: resolveRetentionPlan({ TELEMETRY_RETENTION_MODE: 'enforce' }).items });
        expect(await rows(`SELECT created_at IS NULL AS untimed FROM event_logs ORDER BY created_at NULLS LAST`)).toEqual([
            { untimed: false }, { untimed: true },
        ]);
    });

    it('never touches lifecycle or unknown event types, ledgers, audit, billing or send guards at any age', async () => {
        for (const type of ['request_created', 'seller_submitted', 'submitted_sheet_edited', 'request_reopened', 'reminder_sent',
            'admin_request_status_changed', 'test_drive_delivery_succeeded', 'some_future_event']) {
            await event(type, OLD, { actor: 'agent' }, null);
        }
        await db.exec(`
            INSERT INTO reminder_operations (id, request_id, actor_type, recipient_email, payload_fingerprint, state, created_at)
                VALUES (gen_random_uuid(), '${REQ}', 'agent', 'sam@example.com', '${'a'.repeat(64)}', 'accepted', NOW() - INTERVAL '${OLD} days');
            INSERT INTO admin_audit_logs (admin_id, action, ip_address, created_at) VALUES ('${ADMIN}', 'role_changed', '203.0.113.9', NOW() - INTERVAL '${OLD} days');
            INSERT INTO account_security_events (account_id, action, created_at) VALUES ('${OWNER}', 'password_changed', NOW() - INTERVAL '${OLD} days');
            INSERT INTO referral_credits (referrer_account_id, referred_account_id, earned_at) VALUES ('${OWNER}', '${REFERRED}', NOW() - INTERVAL '${OLD} days');
            INSERT INTO activation_outreach_logs (account_id, email, stage, status, created_at) VALUES ('${OWNER}', 'owner@example.com', 'after_1d', 'sent', NOW() - INTERVAL '${OLD} days');
            INSERT INTO testimonial_outreach_logs (user_id, recipient_email, subject, status, sent_at) VALUES ('${OWNER}', 'owner@example.com', 'Hi', 'sent', NOW() - INTERVAL '${OLD} days');
            INSERT INTO growth_referral_events (event_type, occurred_at) VALUES ('impression', NOW() - INTERVAL '${OLD} days');
        `);

        // Twice, so a second batch has its chance as well.
        for (let i = 0; i < 2; i++) await runRetention({ db: exec, items: resolveRetentionPlan(ENFORCE_ALL).items });

        expect(await count(`SELECT COUNT(*)::int AS n FROM event_logs`)).toBe(8);
        for (const table of ['reminder_operations', 'admin_audit_logs', 'account_security_events', 'referral_credits',
            'activation_outreach_logs', 'testimonial_outreach_logs', 'growth_referral_events']) {
            expect(await count(`SELECT COUNT(*)::int AS n FROM ${table}`)).toBe(1);
        }
        expect(await count(`SELECT COUNT(*)::int AS n FROM admin_audit_logs WHERE ip_address IS NOT NULL`)).toBe(1);
        expect(await count(`SELECT COUNT(*)::int AS n FROM requests`)).toBe(2);
    });

    it('clears IP and browser header after 30 days and keeps the row and its data', async () => {
        await event('seller_submitted', 31, { actor: 'seller', device: 'mobile', browser: 'safari' });
        await event('seller_opened', 29);

        await runRetention({ db: exec, items: resolveRetentionPlan({ TELEMETRY_RETENTION_MODE: 'enforce' }).items });
        expect(await rows(`SELECT event_type, event_data, ip_address, user_agent FROM event_logs ORDER BY created_at`)).toEqual([
            { event_type: 'seller_submitted', event_data: { actor: 'seller', device: 'mobile', browser: 'safari' }, ip_address: null, user_agent: null },
            { event_type: 'seller_opened', event_data: {}, ip_address: '198.51.100.7', user_agent: 'Mozilla/5.0 (iPhone)' },
        ]);
    });

    it('historical cleanup removes only the listed keys, and only with its own switch', async () => {
        await event('request_created', 300, {
            actor: 'seller', source: 'intake_link', slug: 'my-form', suffix: 'a1',
            submitted_property_address: '12 Private Rd', canonical_property_address: '12 Private Road', utility_categories: ['gas'],
        }, null);
        await event('request_created', 300, { actor: 'agent', utility_categories: ['electric'] }, null);
        await event('suggestions_search', 10, { category: 'gas', query_length: 4, result_count: 1, top_results: ['Town Gas'] }, null);
        await event('suggestions_fetched', 10, { categories: ['gas'], category_count: 1, top_results_by_category: { gas: ['Town Gas'] } }, null);

        await runRetention({ db: exec, items: resolveRetentionPlan({ TELEMETRY_RETENTION_MODE: 'enforce' }).items });
        expect(await count(`SELECT COUNT(*)::int AS n FROM event_logs WHERE event_data ? 'slug' OR event_data ? 'top_results'`)).toBe(2);

        await runRetention({ db: exec, items: resolveRetentionPlan(ENFORCE_ALL).items });
        expect(await rows(`SELECT event_type, event_data FROM event_logs ORDER BY event_type, (event_data->>'actor')`)).toEqual([
            { event_type: 'request_created', event_data: { actor: 'agent', utility_categories: ['electric'] } },
            { event_type: 'request_created', event_data: { actor: 'seller', source: 'intake_link', utility_categories: ['gas'] } },
            { event_type: 'suggestions_fetched', event_data: { categories: ['gas'], category_count: 1 } },
            { event_type: 'suggestions_search', event_data: { category: 'gas', query_length: 4, result_count: 1 } },
        ]);
    });

    it('changes at most one batch per class per run, oldest first', async () => {
        for (let age = 95; age < 100; age++) await event('seller_step_viewed', age, { n: age }, null);
        const items = resolveRetentionPlan({ TELEMETRY_RETENTION_MODE: 'enforce' }).items;

        const first = await runRetention({ db: exec, items, batchLimit: 2 });
        expect(first.find((item) => item.key === 'sellerDiagnostics')?.affected).toBe(2);
        expect(await rows(`SELECT (event_data->>'n')::int AS n FROM event_logs ORDER BY 1`)).toEqual([{ n: 95 }, { n: 96 }, { n: 97 }]);

        await runRetention({ db: exec, items, batchLimit: 2 });
        await runRetention({ db: exec, items, batchLimit: 2 });
        expect(await count(`SELECT COUNT(*)::int AS n FROM event_logs`)).toBe(0);
    });

    it('leaves request deletion behavior unchanged before and after a run', async () => {
        await event('seller_opened', 200, {}, '198.51.100.7', SOFT_DELETED);
        await event('seller_submitted', 200, {}, '198.51.100.7', SOFT_DELETED);
        await aiRun(10);

        await runRetention({ db: exec, items: resolveRetentionPlan({ TELEMETRY_RETENTION_MODE: 'enforce' }).items });
        // Soft-deleted request: still there with its lifecycle row; the old open went by age like any other.
        expect(await rows(`SELECT event_type, ip_address FROM event_logs WHERE request_id = $1`, [SOFT_DELETED])).toEqual([
            { event_type: 'seller_submitted', ip_address: null },
        ]);
        expect(await count(`SELECT COUNT(*)::int AS n FROM requests WHERE deleted_at IS NOT NULL`)).toBe(1);

        // Hard delete still cascades events and detaches AI rows.
        await db.exec(`DELETE FROM requests WHERE id = '${REQ}'`);
        expect(await count(`SELECT COUNT(*)::int AS n FROM ai_generation_runs WHERE request_id IS NULL`)).toBe(1);
        await runRetention({ db: exec, items: resolveRetentionPlan({ TELEMETRY_RETENTION_MODE: 'enforce' }).items });
        expect(await count(`SELECT COUNT(*)::int AS n FROM ai_generation_runs`)).toBe(1);
    });
});

describe('scheduled run', () => {
    it('runs at most once a day, records its own job run and is shown in Admin status', async () => {
        await event('seller_step_viewed', 120, {}, null);
        const env = { TELEMETRY_RETENTION_MODE: 'preview' };
        const now = new Date();

        const first = await runScheduledRetention({ db: exec, env, now });
        expect(first).toMatchObject({ status: 'ran', mode: 'preview', failed: 0 });
        expect(await count(`SELECT COUNT(*)::int AS n FROM event_logs`)).toBe(1);

        expect(await runScheduledRetention({ db: exec, env, now: new Date(now.getTime() + 60 * 60_000) })).toEqual({ status: 'not_due', mode: 'preview' });
        expect(await runScheduledRetention({ db: exec, env, now: new Date(now.getTime() + 24 * 3_600_000) })).toMatchObject({ status: 'ran' });

        const status = await getRetentionStatus(exec, env);
        expect(status.mode).toBe('preview');
        expect(status.lastRun).toMatchObject({ status: 'success' });
        expect(status.lastRun?.summary).toMatchObject({ sellerDiagnostics: 1, sellerDiagnosticsAction: 1, failed: 0 });
        expect(status.plan.find((item) => item.key === 'sellerDiagnostics')).toEqual({
            key: 'sellerDiagnostics', label: 'Seller browser diagnostics', kind: 'delete', action: 'preview', windowDays: 90,
        });
    });

    it('isolates a failing class, marks the run partial and never throws', async () => {
        await event('seller_step_viewed', 120, {}, null);
        const failing: StatementExecutor = {
            run: async (statement, options) => {
                if (statement.text.includes('FROM ai_generation_runs')) throw Object.assign(new Error('boom'), { name: 'NeonDbError' });
                return exec.run(statement, options);
            },
            transaction: (statements) => exec.transaction(statements),
        };

        const result = await runScheduledRetention({ db: failing, env: { TELEMETRY_RETENTION_MODE: 'enforce' } });
        expect(result).toMatchObject({ status: 'failed', failed: 1 });
        expect(result && 'classes' in result ? result.classes.find((item) => item.key === 'aiRuns') : null).toMatchObject({ failed: true });
        expect(await count(`SELECT COUNT(*)::int AS n FROM event_logs`)).toBe(0);
        expect(await rows(`SELECT status FROM job_runs WHERE job_name = 'telemetry_retention'`)).toEqual([{ status: 'partial' }]);
        const logged = vi.mocked(console.error).mock.calls.map((call) => String(call[0])).join('\n');
        expect(logged).toContain('"retentionClass":"aiRuns"');
        expect(logged).toContain('"errorName":"NeonDbError"');
        expect(logged).not.toContain('boom');

        const broken: StatementExecutor = { run: async () => { throw new Error('connection reset'); }, transaction: async () => [] };
        expect(await runScheduledRetention({ db: broken, env: { TELEMETRY_RETENTION_MODE: 'enforce' } })).toEqual({
            status: 'failed', mode: 'enforce', classes: [], failed: 1,
        });
    });
});
