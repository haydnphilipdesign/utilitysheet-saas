// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ tagged: vi.fn(), query: vi.fn(), requireAdmin: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/neon/db', () => ({ sql: Object.assign(mocks.tagged, { query: mocks.query }) }));
vi.mock('@/lib/admin', () => ({ requireAdmin: mocks.requireAdmin }));

import { insertSellerObservations, type SellerObservationRow } from '@/lib/neon/queries/seller-observations';
import { getSellerProgressData } from '@/lib/neon/queries/admin-seller-progress';
import { SELLER_OBSERVATION_MAX_PER_REQUEST } from '@/lib/telemetry/seller-observations';

let db: PGlite;
let counter = 0;
const id = () => `event-${String(++counter).padStart(12, '0')}`;

function row(type: SellerObservationRow['eventType'], data: Record<string, unknown>, eventId: string = id()): SellerObservationRow {
    return { eventType: type, eventId, eventData: { v: 1, actor: 'seller_browser', mode: 'live', session_id: 'session-a', event_id: eventId, seq: 0, edit_version: 0, ...data } };
}
const viewed = (step: string, seq: number, data: Record<string, unknown> = {}, eventId?: string) =>
    row('seller_step_viewed', { step, seq, nav: 'linear', visit: 'first', ...data }, eventId);
const stored = async (requestId: string) =>
    (await db.query<{ event_type: string; event_data: Record<string, unknown>; ip_address: string | null; user_agent: string | null }>(
        'SELECT event_type, event_data, ip_address, user_agent FROM event_logs WHERE request_id = $1 ORDER BY id', [requestId])).rows;

beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
        CREATE TABLE accounts (id text PRIMARY KEY, role text, full_name text, email text);
        CREATE TABLE requests (id text PRIMARY KEY, account_id text, status text, is_demo boolean DEFAULT false,
            deleted_at timestamptz, metered_at timestamptz, created_at timestamptz DEFAULT NOW() - INTERVAL '10 days',
            property_address text, seller_edit_version int DEFAULT 0);
        CREATE TABLE event_logs (id serial PRIMARY KEY, request_id text, event_type text NOT NULL, event_data jsonb,
            ip_address text, user_agent text, created_at timestamptz DEFAULT NOW());
    `);
}, 30000);
afterAll(async () => db.close());
beforeEach(async () => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: 'admin' });
    mocks.query.mockImplementation(async (text: string, values: unknown[]) => (await db.query(text, values)).rows);
    mocks.tagged.mockImplementation(async (strings: TemplateStringsArray, ...values: unknown[]) =>
        (await db.query(strings.reduce((q, part, i) => q + (i ? `$${i}` : '') + part, ''), values)).rows);
    await db.exec(`TRUNCATE accounts, requests, event_logs RESTART IDENTITY;
        INSERT INTO accounts (id, role) VALUES ('customer','user'),('staff','admin');
        INSERT INTO requests (id, account_id, status, seller_edit_version) VALUES
            ('one','customer','in_progress',0),('two','customer','in_progress',0),('silent','customer','in_progress',0),
            ('reopened','customer','in_progress',1),('done','customer','submitted',0),
            ('trial','customer','in_progress',0),('removed','customer','in_progress',0),('internal','staff','in_progress',0);
        UPDATE requests SET is_demo = true WHERE id = 'trial';
        UPDATE requests SET deleted_at = NOW() WHERE id = 'removed';
        UPDATE requests SET metered_at = NOW() - INTERVAL '3 days' WHERE id = 'reopened';`);
});

describe('seller observation storage', () => {
    it('stores a batch in order with empty IP and user-agent columns', async () => {
        const inserted = await insertSellerObservations({ requestId: 'one', rows: [viewed('welcome', 0), viewed('home_basics', 1)] });
        expect(inserted).toBe(2);
        const rows = await stored('one');
        expect(rows.map(r => r.event_data.step)).toEqual(['welcome', 'home_basics']);
        expect(rows.every(r => r.ip_address === null && r.user_agent === null)).toBe(true);
    });

    it('does not store an event id twice, across resends or inside one batch', async () => {
        const first = viewed('welcome', 0, {}, 'event-resent-000001');
        expect(await insertSellerObservations({ requestId: 'one', rows: [first] })).toBe(1);
        // A resend of the same batch plus one new event, with the new one repeated.
        const fresh = viewed('home_basics', 1, {}, 'event-fresh-0000001');
        expect(await insertSellerObservations({ requestId: 'one', rows: [first, fresh, fresh] })).toBe(1);
        expect((await stored('one')).map(r => r.event_data.event_id)).toEqual(['event-resent-000001', 'event-fresh-0000001']);
        // The same id on another request is a different event.
        expect(await insertSellerObservations({ requestId: 'two', rows: [first] })).toBe(1);
    });

    it('stops storing at the per-request ceiling without touching other requests or event types', async () => {
        await db.query(`INSERT INTO event_logs (request_id, event_type, event_data)
            SELECT 'one', 'seller_step_viewed', jsonb_build_object('event_id', 'fill-' || n) FROM generate_series(1, $1) AS n`,
            [SELLER_OBSERVATION_MAX_PER_REQUEST - 1]);
        await db.exec(`INSERT INTO event_logs (request_id, event_type) VALUES ('one', 'seller_opened'), ('one', 'reminder_sent')`);
        expect(await insertSellerObservations({ requestId: 'one', rows: [viewed('review', 9), viewed('success', 10)] })).toBe(0);
        expect(await insertSellerObservations({ requestId: 'one', rows: [viewed('review', 9)] })).toBe(1);
        expect(await insertSellerObservations({ requestId: 'one', rows: [viewed('success', 10)] })).toBe(0);
        expect(await insertSellerObservations({ requestId: 'two', rows: [viewed('review', 9)] })).toBe(1);
    });

    it('passes the abort signal to the driver and stores nothing for an empty batch', async () => {
        const controller = new AbortController();
        await insertSellerObservations({ requestId: 'one', rows: [viewed('welcome', 0)] }, { signal: controller.signal });
        expect(mocks.query.mock.calls[0][2]).toEqual({ fetchOptions: { signal: controller.signal } });
        mocks.query.mockClear();
        expect(await insertSellerObservations({ requestId: 'one', rows: [] })).toBe(0);
        expect(mocks.query).not.toHaveBeenCalled();
    });
});


describe('seller progress aggregation of browser observations', () => {
    it('counts each request once at its last reported step, whatever was repeated, revisited or late', async () => {
        // Request one: forward to water, back to electric (revisit), duplicate of the last view sent again.
        await insertSellerObservations({ requestId: 'one', rows: [
            viewed('welcome', 0), viewed('home_basics', 1),
            viewed('utility', 2, { category: 'electric' }), viewed('utility', 3, { category: 'water' }),
            viewed('utility', 4, { category: 'electric', visit: 'revisit' }, 'event-last-view-01'),
        ] });
        await insertSellerObservations({ requestId: 'one', rows: [viewed('utility', 4, { category: 'electric', visit: 'revisit' }, 'event-last-view-01')] });
        // Two byte-identical rows, as two simultaneous sends could leave behind.
        await db.exec(`INSERT INTO event_logs (request_id, event_type, event_data)
            SELECT request_id, event_type, event_data FROM event_logs WHERE event_data->>'event_id' = 'event-last-view-01'`);
        // An early batch that arrives after everything else must not move the seller back to Welcome.
        await db.exec(`UPDATE event_logs SET created_at = NOW() - INTERVAL '5 minutes' WHERE request_id = 'one'`);
        await insertSellerObservations({ requestId: 'one', rows: [viewed('welcome', 0, {}, 'event-late-welcome')] });

        // Request two: reached review and reported two failed submits.
        await insertSellerObservations({ requestId: 'two', rows: [
            viewed('review', 7, { session_id: 'session-b' }),
            row('seller_submission_attempted', { seq: 8, attempt: 1, session_id: 'session-b' }),
            row('seller_submission_failed', { seq: 9, attempt: 1, error_code: 'server_error', status: 500, session_id: 'session-b' }),
            row('seller_submission_failed', { seq: 11, attempt: 2, error_code: 'rate_limited', status: 429, session_id: 'session-b' }),
        ] });

        // Excluded populations.
        for (const requestId of ['done', 'trial', 'removed', 'internal']) {
            await insertSellerObservations({ requestId, rows: [viewed('review', 1)] });
        }

        const result = (await getSellerProgressData())!;
        expect(result.inProgressCount).toBe(4);
        expect(result.browserObserved).toBe(2);
        expect(result.byLastStep).toEqual([
            { step: 'review', category: null, count: 1 },
            { step: 'utility', category: 'electric', count: 1 },
        ]);
        expect(result.byLastStep.reduce((total, r) => total + r.count, 0)).toBe(result.browserObserved);

        const one = result.rows.find(r => r.request_id === 'one')!;
        expect(one).toMatchObject({ last_step: 'utility', last_step_category: 'electric', last_failure_code: null, browser_sessions: 1,
            last_event_type: 'seller_step_viewed', last_other_event_type: null });
        expect(one.hours_since_last_event).not.toBeNull();
        const two = result.rows.find(r => r.request_id === 'two')!;
        expect(two).toMatchObject({ last_step: 'review', last_failure_code: 'rate_limited', browser_sessions: 1,
            last_event_type: 'seller_submission_failed' });
        expect(two.last_event_data).toMatchObject({ error_code: 'rate_limited' });
        expect(result.rows.find(r => r.request_id === 'silent')).toMatchObject({ last_step: null, browser_sessions: 0, last_event_type: null });
        expect(result.unknownActivity).toBe(2);
    });

    it('uses the tab session heard from most recently and keeps operator events separate', async () => {
        await insertSellerObservations({ requestId: 'one', rows: [viewed('review', 30, { session_id: 'session-old' })] });
        await db.exec(`UPDATE event_logs SET created_at = NOW() - INTERVAL '2 days' WHERE request_id = 'one'`);
        await insertSellerObservations({ requestId: 'one', rows: [viewed('home_basics', 1, { session_id: 'session-new' })] });
        await db.exec(`INSERT INTO event_logs (request_id, event_type) VALUES ('one', 'reminder_sent')`);

        const one = (await getSellerProgressData())!.rows.find(r => r.request_id === 'one')!;
        expect(one).toMatchObject({ last_step: 'home_basics', browser_sessions: 2,
            last_event_type: 'seller_step_viewed', last_other_event_type: 'reminder_sent' });
    });

    it('scopes browser observations to the current editing session of a reopened request', async () => {
        // Reported before the reopen, and by a stale tab after it: neither describes the reopened form.
        await insertSellerObservations({ requestId: 'reopened', rows: [viewed('review', 5, { edit_version: 0 })] });
        await db.exec(`UPDATE event_logs SET created_at = NOW() - INTERVAL '4 days' WHERE request_id = 'reopened';
            INSERT INTO event_logs (request_id, event_type, created_at) VALUES ('reopened', 'request_reopened', NOW() - INTERVAL '1 day')`);
        await insertSellerObservations({ requestId: 'reopened', rows: [viewed('utility', 6, { edit_version: 0, category: 'gas' })] });

        let reopened = (await getSellerProgressData())!.rows.find(r => r.request_id === 'reopened')!;
        expect(reopened).toMatchObject({ last_step: null, browser_sessions: 0, last_event_type: null, is_reopened: true });

        await insertSellerObservations({ requestId: 'reopened', rows: [viewed('review', 0, { edit_version: 1, session_id: 'session-c' })] });
        reopened = (await getSellerProgressData())!.rows.find(r => r.request_id === 'reopened')!;
        expect(reopened).toMatchObject({ last_step: 'review', browser_sessions: 1, last_event_type: 'seller_step_viewed' });
    });

    it('drops values outside the contract instead of reporting them', async () => {
        await db.exec(`INSERT INTO event_logs (request_id, event_type, event_data) VALUES
            ('one', 'seller_step_viewed', '{"actor":"seller_browser","edit_version":0,"session_id":"s","seq":"not-a-number","step":"12 Sentinel Street","category":"sentinel"}'),
            ('one', 'seller_submission_failed', '{"actor":"seller_browser","edit_version":0,"session_id":"s","seq":1,"error_code":"sentinel raw error"}'),
            ('two', 'seller_step_viewed', '{"actor":"seller_browser","edit_version":0,"session_id":"s","seq":"9999999999","step":"utility","category":"sentinel"}')`);
        const result = (await getSellerProgressData())!;
        expect(result.rows.find(r => r.request_id === 'one')).toMatchObject({ last_step: null, last_failure_code: null });
        expect(result.rows.find(r => r.request_id === 'two')).toMatchObject({ last_step: 'utility', last_step_category: null });
        expect(JSON.stringify(result)).not.toMatch(/sentinel/i);
    });
});
