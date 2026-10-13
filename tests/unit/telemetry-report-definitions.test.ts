// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ sql: vi.fn(), requireAdmin: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/neon/db', () => ({ sql: mocks.sql }));
vi.mock('@/lib/admin', () => ({ requireAdmin: mocks.requireAdmin }));
import { getActivationFunnelStats, getGrowthSourceStats, getReferralLoopStats } from '@/lib/admin/activation-funnel';
import { getSellerProgressData } from '@/lib/neon/queries/admin-seller-progress';

let db: PGlite;
beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
        CREATE TABLE accounts (id text PRIMARY KEY, role text, full_name text, email text,
            active_organization_id text, onboarding_completed_at timestamptz, subscription_status text,
            created_at timestamptz DEFAULT NOW());
        CREATE TABLE organizations (id text, subscription_status text);
        CREATE TABLE brand_profiles (id text, account_id text);
        CREATE TABLE intake_links (id text, account_id text);
        CREATE TABLE requests (id text PRIMARY KEY, account_id text, status text, is_demo boolean DEFAULT false,
            deleted_at timestamptz, metered_at timestamptz, last_activity_at timestamptz,
            created_at timestamptz DEFAULT NOW() - INTERVAL '10 days', property_address text,
            seller_name text, seller_email text, seller_edit_version int DEFAULT 0);
        CREATE TABLE event_logs (id serial, request_id text, event_type text, event_data jsonb, created_at timestamptz);
        CREATE TABLE growth_attributions (account_id text, source text, medium text);
        CREATE TABLE growth_referral_events (event_type text, occurred_at timestamptz);
    `);
}, 30000);
afterAll(async () => db.close());
beforeEach(async () => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: 'admin' });
    mocks.sql.mockImplementation(async (strings: TemplateStringsArray, ...values: unknown[]) =>
        (await db.query(strings.reduce((q, part, i) => q + (i ? `$${i}` : '') + part, ''), values)).rows);
    await db.exec(`TRUNCATE accounts, requests, event_logs, growth_attributions;
        INSERT INTO accounts (id, role) VALUES ('modern','user'),('legacy','user'),('excluded','user'),('admin','admin');
        INSERT INTO growth_attributions VALUES ('modern','referral','product_referral'),('legacy','legacy','direct'),('excluded','other','direct');
        INSERT INTO requests (id,account_id,status,metered_at,last_activity_at,seller_edit_version) VALUES
            ('reopened','modern','in_progress',NOW()-INTERVAL '2 days',NOW(),1),
            ('second','modern','draft',NOW()-INTERVAL '3 days',NOW(),0),
            ('third','modern','submitted',NOW()-INTERVAL '4 days',NOW(),0),
            ('legacy','legacy','submitted',NULL,NOW()-INTERVAL '3 days',0),
            ('untimed','excluded','submitted',NULL,NULL,0),
            ('draft','excluded','in_progress',NULL,NOW(),0),
            ('deleted','excluded','in_progress',NOW(),NOW(),0),
            ('demo','excluded','in_progress',NOW(),NOW(),0),
            ('admin','admin','in_progress',NOW(),NOW(),0);
        UPDATE requests SET deleted_at=NOW() WHERE id='deleted';
        UPDATE requests SET is_demo=true WHERE id='demo';
    `);
});

describe('retained customer report definitions against PostgreSQL', () => {
    it('retains metered activation and habit after reopen, includes timed legacy fallback and excludes demo/deletion/admin', async () => {
        expect(await getActivationFunnelStats()).toMatchObject({ totalAccounts: 3, firstLiveSubmission: 2,
            habitualAccounts: 1, firstLiveSubmissionLast7d: 2 });
        expect(await getGrowthSourceStats()).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'referral', activated: 1 }),
            expect.objectContaining({ source: 'legacy', activated: 1 }),
            expect.objectContaining({ source: 'other', activated: 0 }),
        ]));
        expect(await getReferralLoopStats()).toMatchObject({ signups: 1, activated: 1 });
        await db.exec(`UPDATE requests SET metered_at=NOW()-INTERVAL '60 days', last_activity_at=NOW() WHERE id='third'`);
        expect(await getActivationFunnelStats()).toMatchObject({ firstLiveSubmission: 2, habitualAccounts: 0, firstLiveSubmissionLast7d: 1 });
    });

    it('keeps unknown seller evidence separate from operator freshness and resets observation scope on reopen', async () => {
        await db.exec(`INSERT INTO event_logs (request_id,event_type,event_data,created_at) VALUES
            ('reopened','seller_opened',NULL,NOW()-INTERVAL '3 days'),
            ('reopened','request_reopened',NULL,NOW()-INTERVAL '1 day'),
            ('reopened','reminder_sent',NULL,NOW()),
            ('draft','suggestions_fetched','{"categories":["electric","electric","unknown"],"private":"sentinel"}',NOW()-INTERVAL '2 days'),
            ('draft','submitted_sheet_edited',NULL,NOW()),
            ('deleted','seller_opened',NULL,NOW()),('demo','seller_opened',NULL,NOW()),('admin','seller_opened',NULL,NOW());`);
        const result = (await getSellerProgressData())!;
        expect(result).toMatchObject({ totalRequests: 6, inProgressCount: 2, unknownActivity: 1,
            active24h: 0, inactive1To7d: 1, inactiveOver7d: 0,
            byLastCategory: [{ category: 'electric', count: 1 }] });
        expect(result.byLastEvent).toEqual(expect.arrayContaining([
            { event_type: 'unknown', count: 1 }, { event_type: 'suggestions_fetched', count: 1 },
        ]));
        expect(result.rows.find(r => r.request_id === 'reopened')).toMatchObject({
            last_event_type: null, hours_since_last_event: null, last_other_event_type: 'reminder_sent', is_reopened: true,
        });
        expect(result.rows.find(r => r.request_id === 'draft')).toMatchObject({ last_event_type: 'suggestions_fetched',
            last_other_event_type: 'submitted_sheet_edited' });
        expect(JSON.stringify(result)).not.toContain('sentinel');
    });

    it('authorizes before reading and propagates store failure rather than inventing zeros', async () => {
        mocks.requireAdmin.mockRejectedValueOnce(new Error('denied'));
        await expect(getSellerProgressData()).rejects.toThrow('denied');
        expect(mocks.sql).not.toHaveBeenCalled();
        mocks.sql.mockRejectedValueOnce(new Error('unavailable'));
        await expect(getSellerProgressData()).rejects.toThrow('unavailable');
    });
});
