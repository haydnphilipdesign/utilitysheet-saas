// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createSchemaDatabase, pgliteTaggedSql } from '../helpers/pglite-db';

// Needs Attention, Waiting on seller, and the automatic reminder candidates,
// run against the real schema in embedded PostgreSQL.
const holder = vi.hoisted(() => ({ sql: null as unknown }));
vi.mock('@/lib/neon/db', () => ({
    get sql() { return holder.sql; },
    generateToken: () => 'unused',
}));

import { getDashboardStats, getRequests } from '@/lib/neon/queries/requests';
import { getDueAutomaticReminderCandidates } from '@/lib/neon/queries/automatic-reminders';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ON = id(1);
const OFF = id(2);
let db: PGlite;

type Row = { n: number; owner: string; status: string; email: string | null; createdDaysAgo: number; idleHours: number; demo?: boolean; reminded?: boolean };

// n: what each row tests.
const rows: Row[] = [
    { n: 11, owner: ON, status: 'in_progress', email: 'a@example.com', createdDaysAgo: 2, idleHours: 30 }, // due; not yet 2 days idle
    { n: 12, owner: ON, status: 'in_progress', email: 'b@example.com', createdDaysAgo: 1, idleHours: 2 }, // seller still active
    { n: 13, owner: ON, status: 'sent', email: null, createdDaysAgo: 4, idleHours: 72 }, // no email: attention only
    { n: 14, owner: ON, status: 'in_progress', email: 'd@example.com', createdDaysAgo: 40, idleHours: 900 }, // abandoned, outside window
    { n: 15, owner: ON, status: 'submitted', email: 'e@example.com', createdDaysAgo: 3, idleHours: 70 }, // done
    { n: 16, owner: ON, status: 'in_progress', email: 'f@example.com', createdDaysAgo: 2, idleHours: 30, reminded: true }, // already reminded
    { n: 17, owner: ON, status: 'in_progress', email: 'g@example.com', createdDaysAgo: 2, idleHours: 30, demo: true }, // seller test
    { n: 18, owner: ON, status: 'sent', email: 'h@example.com', createdDaysAgo: 5, idleHours: 72 }, // due and needs attention
    { n: 21, owner: OFF, status: 'in_progress', email: 'i@example.com', createdDaysAgo: 2, idleHours: 30 }, // setting off
];

beforeAll(async () => {
    db = await createSchemaDatabase();
    holder.sql = pgliteTaggedSql(db);
    await db.exec(`
        INSERT INTO accounts (id, email, role, full_name, notification_preferences) VALUES
            ('${ON}', 'on@example.com', 'user', 'Olivia On', '{"auto_seller_reminders": true}'),
            ('${OFF}', 'off@example.com', 'user', 'Oscar Off', '{}');
    `);
    for (const row of rows) {
        await db.query(
            `INSERT INTO requests (id, account_id, property_address, seller_email, status, public_token, seller_token,
                is_demo, created_at, last_activity_at, metered_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() - make_interval(days => $9::int), NOW() - make_interval(hours => $10::int),
                CASE WHEN $5 = 'submitted' THEN NOW() END)`,
            [id(row.n), row.owner, `${row.n} Main St`, row.email, row.status, `pub${row.n}`, `sel${row.n}`, row.demo === true, row.createdDaysAgo, row.idleHours]
        );
        if (row.reminded) {
            await db.query(`INSERT INTO event_logs (request_id, event_type, event_data) VALUES ($1, 'reminder_sent', '{}')`, [id(row.n)]);
        }
    }
}, 60000);
afterAll(async () => { await db?.close(); });

const ids = (list: Array<{ id?: string; request_id?: string }>) => list.map((item) => item.id ?? item.request_id).sort();

describe('seller follow-up rules', () => {
    it('picks only requests due their one automatic reminder, oldest activity first', async () => {
        const due = await getDueAutomaticReminderCandidates(25);
        expect(due.map((item) => item.request_id)).toEqual([id(18), id(11)]);
        expect(due[0]).toMatchObject({ owner_account_id: ON, owner_full_name: 'Olivia On' });
    });

    it('flags sent or opened requests quiet for 2 days, within the last 30 days', async () => {
        const result = await getRequests(ON, undefined, { status: 'needs_attention' });
        expect(ids(result.data)).toEqual([id(13), id(18)]);
        expect(result.data.every((request) => (request as { needs_attention?: boolean }).needs_attention)).toBe(true);
    });

    it('lists requests waiting on the seller within the same window', async () => {
        const result = await getRequests(ON, undefined, { status: 'waiting' });
        expect(ids(result.data)).toEqual([id(11), id(12), id(13), id(16), id(18)]);
    });

    it('counts the same numbers for the dashboard', async () => {
        const stats = await getDashboardStats(ON);
        expect(stats.waiting).toBe(5);
        expect(stats.needs_attention).toBe(2);
        // The plain status counts still include old open requests.
        expect(stats.in_progress).toBe(4);
    });
});
