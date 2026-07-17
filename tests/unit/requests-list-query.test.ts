import { beforeEach, describe, expect, it, vi } from 'vitest';

const sqlMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/neon/db', () => ({
    sql: sqlMock,
    generateToken: () => 'test-token',
    isDbConfigured: () => true,
}));

import { getRequests } from '@/lib/neon/queries/requests';

function callSqlText(call: unknown[]): string {
    const [strings] = call as [TemplateStringsArray];
    return Array.from(strings).join('');
}

function callSqlValues(call: unknown[]): unknown[] {
    return call.slice(1);
}

describe('getRequests list query', () => {
    beforeEach(() => {
        sqlMock.mockReset();
    });

    it('keeps personal requests account-scoped while applying server search and status filtering', async () => {
        sqlMock
            .mockResolvedValueOnce([{ count: '1' }])
            .mockResolvedValueOnce([{ id: 'req_1', property_address: '987 Oak Street' }]);

        const result = await getRequests('acct_1', undefined, {
            page: 1,
            limit: 20,
            search: 'Oak',
            status: 'submitted',
            sort: 'last_activity_desc',
            canViewLockedDetails: false,
        });

        expect(result.data).toHaveLength(1);
        expect(result).toMatchObject({
            total: 1,
            page: 1,
            limit: 20,
            totalPages: 1,
            hasPreviousPage: false,
            hasNextPage: false,
        });

        const queryText = sqlMock.mock.calls.map(callSqlText).join('\n');
        expect(queryText).toContain('account_id = ');
        expect(queryText).toContain('organization_id IS NULL');
        expect(queryText).toContain('deleted_at IS NULL');
        expect(queryText).toContain('POSITION(LOWER(');
        expect(queryText).toContain('property_address');
        expect(queryText).toContain('seller_name');
        expect(queryText).toContain('COALESCE(is_locked, FALSE) = FALSE');
        expect(queryText).toContain('status = ');

        const allValues = sqlMock.mock.calls.flatMap(callSqlValues);
        expect(allValues).toContain('acct_1');
        expect(allValues).toContain('Oak');
        expect(allValues).toContain('submitted');
        expect(allValues).toContain(false);
    });

    it('keeps active-organization visibility limited to org rows plus the current account personal rows', async () => {
        sqlMock
            .mockResolvedValueOnce([{ count: '2' }])
            .mockResolvedValueOnce([{ id: 'org_req' }, { id: 'personal_req' }]);

        await getRequests('acct_1', 'org_1', {
            page: 1,
            limit: 20,
            status: 'all',
            sort: 'created_desc',
            canViewLockedDetails: true,
        });

        const queryText = sqlMock.mock.calls.map(callSqlText).join('\n');
        expect(queryText).toContain('organization_id = ');
        expect(queryText).toContain('(account_id = ');
        expect(queryText).toContain('organization_id IS NULL');

        const allValues = sqlMock.mock.calls.flatMap(callSqlValues);
        expect(allValues).toContain('org_1');
        expect(allValues).toContain('acct_1');
        expect(allValues).toContain(true);
    });

    it('reuses the existing three-day sent rule for Needs Attention before counting and paging', async () => {
        sqlMock
            .mockResolvedValueOnce([{ count: '7' }])
            .mockResolvedValueOnce([{ id: 'req_attention' }]);

        const result = await getRequests('acct_1', undefined, {
            status: 'needs_attention',
            sort: 'last_activity_desc',
        });

        expect(result.total).toBe(7);
        const queryText = sqlMock.mock.calls.map(callSqlText).join('\n');
        expect(queryText).toContain("status = 'sent'");
        expect(queryText).toContain("INTERVAL '1 day'");
        expect(sqlMock.mock.calls.flatMap(callSqlValues)).toContain(3);
    });

    it('clamps an out-of-range page after the filtered count and returns complete metadata', async () => {
        sqlMock
            .mockResolvedValueOnce([{ count: '41' }])
            .mockResolvedValueOnce([{ id: 'req_41' }]);

        const result = await getRequests('acct_1', undefined, {
            page: 99,
            limit: 20,
            sort: 'closing_date_asc',
        });

        expect(result).toEqual({
            data: [{ id: 'req_41' }],
            total: 41,
            page: 3,
            limit: 20,
            totalPages: 3,
            hasPreviousPage: true,
            hasNextPage: false,
        });

        const dataQueryText = callSqlText(sqlMock.mock.calls[1]);
        expect(dataQueryText).toContain('closing_date');
        expect(dataQueryText).toContain('NULLS LAST');
        expect(dataQueryText).toContain('LIMIT ');
        expect(dataQueryText).toContain('OFFSET ');
        expect(callSqlValues(sqlMock.mock.calls[1])).toEqual(expect.arrayContaining([20, 40]));
    });

    it('returns canonical empty pagination metadata after filtering to zero rows', async () => {
        sqlMock
            .mockResolvedValueOnce([{ count: '0' }])
            .mockResolvedValueOnce([]);

        const result = await getRequests('acct_1', undefined, {
            page: 4,
            limit: 20,
            search: 'missing',
        });

        expect(result).toEqual({
            data: [],
            total: 0,
            page: 1,
            limit: 20,
            totalPages: 0,
            hasPreviousPage: false,
            hasNextPage: false,
        });
    });

    it('supports only deterministic schema-backed order expressions', async () => {
        sqlMock
            .mockResolvedValueOnce([{ count: '1' }])
            .mockResolvedValueOnce([{ id: 'req_1' }]);

        await getRequests('acct_1', undefined, {
            sort: 'status_asc',
        });

        const dataQueryText = callSqlText(sqlMock.mock.calls[1]);
        expect(dataQueryText).toContain('last_activity_at');
        expect(dataQueryText).toContain('closing_date');
        expect(dataQueryText).toContain('created_at');
        expect(dataQueryText).toContain("WHEN status = 'draft'");
        expect(dataQueryText).toContain('id DESC');
    });
});
