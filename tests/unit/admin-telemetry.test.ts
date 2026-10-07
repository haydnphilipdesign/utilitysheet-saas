// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), sql: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/admin', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/lib/neon/db', () => ({ sql: mocks.sql }));
import { getAdminTelemetry, telemetryDays } from '@/lib/neon/queries/admin-telemetry';

let db: PGlite;
beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
        CREATE TABLE accounts (id text PRIMARY KEY, role text);
        CREATE TABLE intake_links (id text, account_id text, organization_id text, is_active boolean, deleted_at timestamptz);
        -- A deleted form is not counted as a form.
        INSERT INTO intake_links VALUES ('f-deleted','multi',NULL,false,NOW());
        CREATE TABLE requests (id text, account_id text, organization_id text, source_form_id text,
            packet_mode text DEFAULT 'simple', advanced_modules text[] DEFAULT '{}',
            is_demo boolean DEFAULT false, deleted_at timestamptz, metered_at timestamptz, created_at timestamptz DEFAULT NOW());
        CREATE TABLE event_logs (id serial, request_id text, event_type text, event_data jsonb, created_at timestamptz DEFAULT NOW());
        CREATE TABLE utility_entries (request_id text, category text, entry_mode text);
        CREATE TABLE ai_generation_runs (request_id text, feature text, status text, cache_hit boolean,
            latency_ms integer, created_at timestamptz DEFAULT NOW());
        INSERT INTO accounts VALUES ('multi','user'), ('workspaces','user'), ('empty','user'), ('admin','admin');
        INSERT INTO intake_links VALUES ('f1','multi',NULL,true), ('f2','multi',NULL,false),
            ('w1','workspaces','one',true), ('w2','workspaces','two',true), ('a1','admin',NULL,true);
        INSERT INTO requests (id, account_id, organization_id, source_form_id, metered_at) VALUES
            ('r1','multi',NULL,'f1',NOW()), ('r2','multi',NULL,'f2',NULL),
            ('r3','multi',NULL,'f1',NOW()), ('r4','workspaces','one','w1',NULL),
            ('r5','workspaces','two','w2',NULL), ('legacy','multi',NULL,NULL,NOW()),
            ('admin-r','admin',NULL,'a1',NOW());
        INSERT INTO requests (id,account_id,source_form_id,is_demo,deleted_at,created_at) VALUES
            ('demo','multi','f2',true,NULL,NOW()), ('deleted','multi','f2',false,NOW(),NOW()),
            ('old','multi','f2',false,NULL,NOW() - INTERVAL '60 days');
        INSERT INTO event_logs (request_id,event_type) VALUES
            ('r1','seller_submitted'), ('r1','seller_submitted'), ('old','seller_opened'),
            ('demo','hidden'), ('deleted','hidden'), ('admin-r','hidden');
        INSERT INTO ai_generation_runs (request_id,feature,status,cache_hit,latency_ms) VALUES
            ('r1','provider_search','success',false,120), ('r1','provider_search','success',true,0),
            ('r2','provider_suggestions','fallback',true,0), ('demo','hidden','error',false,999),
            ('deleted','hidden','error',false,999), ('admin-r','hidden','error',false,999),
            (NULL,'hidden','error',false,999);
    `);
}, 30000);
afterAll(async () => { await db?.close(); });
beforeEach(() => {
    mocks.requireAdmin.mockResolvedValue({ id: 'admin' });
    mocks.sql.mockImplementation(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const query = strings.reduce((text, part, i) => text + (i ? `$${i}` : '') + part, '');
        return (await db.query(query, values)).rows;
    });
});

describe('admin telemetry against PostgreSQL', () => {
    it('counts same-scope adoption, distinct usage and attributed completions without join multiplication', async () => {
        const result = await getAdminTelemetry(30);
        expect(result?.forms).toEqual({ accounts: 3, formAccounts: 2, multiFormAccounts: 1,
            forms: 4, activeForms: 3, requests: 6, attributedRequests: 5,
            completedRequests: 2, usedForms: 4, multiFormUsers: 1 });
        expect(result?.events).toEqual([
            { event: 'seller_submitted', count: 2, requests: 1 },
            { event: 'seller_opened', count: 1, requests: 1 },
        ]);
        expect(result?.ai).toEqual([
            { feature: 'provider_search', status: 'success', runs: 2, cached: 1, freshLatencyMs: 120 },
            { feature: 'provider_suggestions', status: 'fallback', runs: 1, cached: 1, freshLatencyMs: null },
        ]);
    });
    it('changes only the request cohort when an older request enters the window', async () => {
        expect((await getAdminTelemetry(90))?.forms.requests).toBe(7);
        expect((await getAdminTelemetry(7))?.forms.requests).toBe(6);
    });
    it('authorizes before executing any query', async () => {
        mocks.requireAdmin.mockRejectedValueOnce(new Error('denied'));
        await expect(getAdminTelemetry(30)).rejects.toThrow('denied');
        expect(mocks.sql).not.toHaveBeenCalled();
    });
    it('propagates query failure rather than reporting zero usage', async () => {
        mocks.sql.mockRejectedValueOnce(new Error('offline'));
        await expect(getAdminTelemetry(30)).rejects.toThrow('offline');
    });
    it('bounds unsupported or duplicate date filters', () => {
        expect(telemetryDays('7')).toBe(7);
        expect(telemetryDays('90')).toBe(90);
        for (const value of [undefined, '0', '365', 'bad', ['7', '90']]) expect(telemetryDays(value)).toBe(30);
    });
    it('deduplicates events, measures ordered outcomes and keeps distinct report cohorts', async () => {
        await db.exec(`BEGIN;
            UPDATE requests SET created_at = NOW() - INTERVAL '3 days' WHERE id IN ('r1','r2','r3','demo');
            UPDATE requests SET packet_mode = 'advanced', advanced_modules = ARRAY['mailbox_access','mailbox_access'] WHERE id = 'r1';
            UPDATE requests SET metered_at = NOW() WHERE id = 'old';
            INSERT INTO requests (id,account_id,created_at) VALUES ('previous','multi',NOW() - INTERVAL '40 days');
            INSERT INTO event_logs (request_id,event_type,event_data,created_at) VALUES
                ('r1','request_created','{"source":"intake_link"}',NOW() - INTERVAL '3 days'),
                ('r1','request_created','{"actor":"agent"}',NOW() - INTERVAL '2 days'),
                ('r2','request_created','{"actor":"agent"}',NOW() - INTERVAL '3 days'),
                ('r1','seller_opened',NULL,NOW() - INTERVAL '2 hours'),
                ('r1','seller_opened',NULL,NOW() - INTERVAL '1 hour'),
                ('r1','reminder_sent',NULL,NOW() - INTERVAL '1 hour'),
                ('r1','reminder_sent',NULL,NOW() - INTERVAL '30 minutes'),
                ('r3','reminder_sent',NULL,NOW() + INTERVAL '1 hour'),
                ('r1','seller_self_send_link',NULL,NOW()),
                ('r1','seller_self_send_link',NULL,NOW()),
                ('r1','submitted_sheet_edited',NULL,NOW() + INTERVAL '1 minute'),
                ('demo','request_created','{"source":"self_serve_test_drive"}',NOW() - INTERVAL '3 days'),
                ('demo','seller_submitted',NULL,NOW() - INTERVAL '1 day'),
                ('demo','seller_submitted',NULL,NOW());
            INSERT INTO utility_entries VALUES ('r1','electric','suggested_confirmed'),
                ('r3','electric','search_selected'), ('old','electric','free_text'),
                ('legacy','water',NULL), ('r1','water','unknown'), ('r1','gas','not_applicable'),
                ('r2','hidden','free_text'), ('demo','hidden','free_text'), ('admin-r','hidden','free_text');
        `);
        try {
            const u = (await getAdminTelemetry(30))!.usage;
            expect(u).toMatchObject({ created: 6, opened: 1, completed: 3, completedWithoutOpen: 2,
                timedCompletions: 1, intake: 1, agent: 1, unknownSource: 4, simple: 5, advanced: 1,
                reminded: 2, completedAfterReminder: 1, returnLinks: 1, edited: 1,
                currentAccounts: 2, previousAccounts: 1, returningAccounts: 1,
                testDriveAccounts: 1, convertedTestDriveAccounts: 1,
                modules: [{ module: 'mailbox_access', requests: 1 }] });
            expect(u.medianHours).toBeCloseTo(2, 2);
            expect(u.providers).toEqual([
                { category: 'electric', total: 3, suggested: 1, searched: 1, manual: 1, unknown: 0, unclassified: 0, notApplicable: 0 },
                { category: 'gas', total: 1, suggested: 0, searched: 0, manual: 0, unknown: 0, unclassified: 0, notApplicable: 1 },
                { category: 'water', total: 2, suggested: 0, searched: 0, manual: 0, unknown: 1, unclassified: 1, notApplicable: 0 },
            ]);
        } finally { await db.exec('ROLLBACK;'); }
    });
    it('returns genuine zero observations for an empty database', async () => {
        await db.exec('BEGIN; DELETE FROM accounts;');
        try {
            const result = await getAdminTelemetry(30);
            expect(Object.values(result!.forms).every((value) => value === 0)).toBe(true);
            expect(result?.events).toEqual([]);
            expect(result?.ai).toEqual([]);
            expect(result?.usage).toMatchObject({ created: 0, opened: 0, completed: 0, medianHours: null,
                currentAccounts: 0, previousAccounts: 0, returningAccounts: 0, testDriveAccounts: 0,
                modules: [], providers: [] });
        } finally {
            await db.exec('ROLLBACK;');
        }
    });
    it('does not treat old test-drive repeats or earlier real submissions as conversion', async () => {
        await db.exec(`BEGIN;
            INSERT INTO event_logs (request_id,event_type,event_data,created_at) VALUES
                ('demo','request_created','{"source":"self_serve_test_drive"}',NOW() - INTERVAL '61 days'),
                ('demo','seller_submitted',NULL,NOW() - INTERVAL '60 days'),
                ('demo','seller_submitted',NULL,NOW());
        `);
        try {
            expect((await getAdminTelemetry(30))!.usage.testDriveAccounts).toBe(0);
            await db.exec(`DELETE FROM event_logs WHERE request_id = 'demo' AND event_type = 'seller_submitted';
                INSERT INTO event_logs (request_id,event_type,created_at) VALUES ('demo','seller_submitted',NOW());
                UPDATE requests SET metered_at = NOW() - INTERVAL '1 day' WHERE account_id = 'multi' AND is_demo = false;`);
            expect((await getAdminTelemetry(30))!.usage).toMatchObject({ testDriveAccounts: 1, convertedTestDriveAccounts: 0 });
        } finally { await db.exec('ROLLBACK;'); }
    });
});
