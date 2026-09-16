import { beforeEach, describe, expect, it, vi } from 'vitest';

type Query = { text: string; values: unknown[] };

const mocks = vi.hoisted(() => ({
    transaction: vi.fn(),
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
        text: strings.join('?'),
        values,
    })),
}));

vi.mock('@/lib/neon/db', () => ({
    sql: Object.assign(mocks.sql, { transaction: mocks.transaction }),
}));

import { removeAccountClosureData } from '@/lib/neon/queries/account-closure';

describe('account closure data transaction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.transaction.mockResolvedValue([]);
    });

    it('transfers shared assets, deletes personal links, and preserves tombstone billing references', async () => {
        await removeAccountClosureData({
            accountId: '11111111-1111-4111-8111-111111111111',
            email: 'owner@example.com',
            soleOrganizationIds: ['22222222-2222-4222-8222-222222222222'],
            transfers: {
                '33333333-3333-4333-8333-333333333333': '44444444-4444-4444-8444-444444444444',
            },
        });

        expect(mocks.transaction).toHaveBeenCalledTimes(1);
        const queries = mocks.transaction.mock.calls[0][0] as Query[];
        const sql = queries.map((query) => query.text.replace(/\s+/g, ' ').trim()).join('\n');

        expect(sql).toContain('UPDATE requests r SET account_id = t.value::uuid');
        expect(sql).toContain('UPDATE brand_profiles b SET account_id = t.value::uuid');
        expect(sql).toContain('DELETE FROM requests WHERE account_id = ? AND organization_id IS NULL');
        expect(sql).toContain('DELETE FROM intake_links WHERE account_id = ?');
        expect(sql).toContain("SET status = 'forfeited'");
        expect(sql).toContain("subscription_status = CASE WHEN subscription_id IS NULL THEN 'free' ELSE 'canceled' END");
        expect(sql).not.toContain('subscription_id = NULL');
    });

    it('guards transferred records even if the closing user lost workspace membership after review', async () => {
        await removeAccountClosureData({
            accountId: '11111111-1111-4111-8111-111111111111',
            email: 'owner@example.com',
            soleOrganizationIds: [],
            transfers: {},
        });

        const guard = (mocks.transaction.mock.calls[0][0] as Query[])[0].text.replace(/\s+/g, ' ');
        expect(guard).toContain('FROM requests r');
        expect(guard).toContain('FROM brand_profiles b');
        expect(guard).toContain('owned.organization_id');
        expect(guard).toContain("recipient.role = 'admin'");
    });
});

