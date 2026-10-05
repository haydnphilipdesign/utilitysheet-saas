// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createSchemaDatabase, pgliteTaggedSql } from '../helpers/pglite-db';

const holder = vi.hoisted(() => ({ sql: null as unknown }));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('@/lib/stack/server', () => ({ stackServerApp: {} }));
vi.mock('@/lib/neon/db', () => ({
    get sql() { return holder.sql; },
}));

import { searchUsers } from '@/lib/admin';
import { getOperationsSummary } from '@/lib/admin/operations-overview';
import {
    PAID_PLAN_ACCESS_EXPLANATION,
    buildStripeRecordLinks,
    describeAccountBilling,
    describeWorkspaceBilling,
    getStripeModeFromKey,
} from '@/lib/admin/billing-context';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let db: PGlite;

beforeAll(async () => {
    db = await createSchemaDatabase();
    holder.sql = pgliteTaggedSql(db);
    await db.exec(`
        INSERT INTO organizations (id, name, slug, subscription_status, subscription_id) VALUES
            ('${id(100)}', 'Team Co', 'team-co', 'team', 'sub_team000001'),
            ('${id(101)}', 'Solo', 'solo', 'free', NULL);
        INSERT INTO accounts (id, email, role, subscription_status, subscription_id, active_organization_id) VALUES
            -- Two members of one Team subscription: two access accounts, one subscription.
            ('${id(1)}', 'team-owner@example.com', 'user', 'free', NULL, '${id(100)}'),
            ('${id(2)}', 'team-member@example.com', 'user', 'free', NULL, '${id(100)}'),
            -- Complimentary Pro override: access without any subscription.
            ('${id(3)}', 'comped@example.com', 'user', 'pro', NULL, NULL),
            -- Stripe-backed Pro.
            ('${id(4)}', 'pro@example.com', 'user', 'pro', 'sub_pro0000001', '${id(101)}'),
            ('${id(5)}', 'free@example.com', 'user', 'free', NULL, NULL),
            ('${id(6)}', 'canceled@example.com', 'user', 'canceled', 'sub_old0000001', NULL),
            -- Admin accounts are never counted as customers.
            ('${id(7)}', 'admin@example.com', 'admin', 'pro', NULL, NULL);
    `);
}, 60000);
afterAll(async () => { await db?.close(); });

describe('paid-plan access count', () => {
    it('counts access accounts, including Team members and complimentary overrides', async () => {
        const summary = await getOperationsSummary();
        expect(summary).toMatchObject({ totalAccounts: 6, proAccounts: 2, teamAccounts: 2, paidAccounts: 4 });
        // Four accounts have access through only two subscriptions: this is not a paying-customer count.
        expect(PAID_PLAN_ACCESS_EXPLANATION).toMatch(/not a count of paying subscriptions/);
    });

    it('agrees exactly with the list the metric links to', async () => {
        const summary = await getOperationsSummary();
        const list = await searchUsers({ plan: 'paying', role: 'user', limit: 200 });
        expect(list.total).toBe(summary!.paidAccounts);
        expect(list.users.map((user) => user.email).sort()).toEqual([
            'comped@example.com', 'pro@example.com', 'team-member@example.com', 'team-owner@example.com',
        ]);
    });
});

describe('billing evidence wording', () => {
    it('does not treat a missing Stripe ID as a fault for complimentary or Team-managed access', () => {
        const comped = describeAccountBilling({ entitlement: 'pro', teamManaged: false });
        expect(comped.tone).toBe('neutral');
        expect(comped.caveat).toMatch(/complimentary or Admin override.*not evidence of payment/);

        const teamManaged = describeAccountBilling({ entitlement: 'free', teamManaged: true });
        expect(teamManaged.tone).toBe('neutral');
        expect(teamManaged.caveat).toMatch(/belongs to the workspace/);
    });

    it('never presents a stored subscription ID as proof of payment', () => {
        expect(describeAccountBilling({ entitlement: 'pro', teamManaged: false, subscriptionId: 'sub_pro0000001' }).caveat)
            .toMatch(/does not prove the subscription is active or paid/);
        const team = describeWorkspaceBilling({ entitlement: 'team', subscriptionId: 'sub_team000001', memberCount: 2 });
        expect(team.caveat).toMatch(/does not prove/);
        expect(team.caveat).toMatch(/2 members each count toward paid-plan access, but this is one subscription/);
    });

    it('flags only genuinely inconsistent stored state for review', () => {
        expect(describeAccountBilling({ entitlement: 'free', teamManaged: false, subscriptionId: 'sub_old0000001' }).tone).toBe('review');
        expect(describeWorkspaceBilling({ entitlement: 'team', subscriptionId: null }).tone).toBe('review');
        expect(describeAccountBilling({ entitlement: 'free', teamManaged: false }).tone).toBe('neutral');
        expect(describeWorkspaceBilling({ entitlement: null }).tone).toBe('neutral');
    });
});

describe('Stripe record links', () => {
    it('derives the dashboard mode from the configured key and refuses to guess', () => {
        expect(getStripeModeFromKey('sk_live_abc')).toBe('live');
        expect(getStripeModeFromKey('rk_test_abc')).toBe('test');
        for (const key of [undefined, null, '', 'pk_live_abc', 'something']) expect(getStripeModeFromKey(key)).toBeNull();
    });

    it('links well-formed identifiers in the right mode and shows others as plain text', () => {
        expect(buildStripeRecordLinks({ customerId: 'cus_ABC123def', subscriptionId: 'sub_ABC123def', mode: 'test' })).toEqual([
            { label: 'Stripe customer', id: 'cus_ABC123def', href: 'https://dashboard.stripe.com/test/customers/cus_ABC123def' },
            { label: 'Stripe subscription', id: 'sub_ABC123def', href: 'https://dashboard.stripe.com/test/subscriptions/sub_ABC123def' },
        ]);
        expect(buildStripeRecordLinks({ customerId: 'cus_ABC123def', mode: 'live' })[0].href)
            .toBe('https://dashboard.stripe.com/customers/cus_ABC123def');
        // Unknown mode or a malformed identifier never becomes a link.
        expect(buildStripeRecordLinks({ customerId: 'cus_ABC123def', mode: null })[0].href).toBeNull();
        expect(buildStripeRecordLinks({ customerId: 'cus_x/../../evil?y=1', mode: 'live' })[0].href).toBeNull();
        expect(buildStripeRecordLinks({ customerId: null, subscriptionId: '  ', mode: 'live' })).toEqual([]);
    });
});
