import { beforeEach, describe, expect, it, vi } from 'vitest';

const sqlMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/neon/db', () => ({
    sql: sqlMock,
    generateToken: () => 'test-token',
    isDbConfigured: () => true,
}));

import { deleteRequest } from '@/lib/neon/queries/requests';
import { ensureAccountRecord, getMonthlyUsage } from '@/lib/neon/queries/accounts';

function callSqlText(call: unknown[]): string {
    const [strings] = call as [TemplateStringsArray];
    return Array.from(strings).join('');
}

describe('Requests: metering + soft-delete', () => {
    beforeEach(() => {
        sqlMock.mockReset();
    });

    it('hard-deletes an unmetered request', async () => {
        sqlMock
            .mockResolvedValueOnce([{ id: 'req_1', metered_at: null, deleted_at: null }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: 'req_1' }]);

        const ok = await deleteRequest('req_1');

        expect(ok).toBe(true);
        expect(sqlMock).toHaveBeenCalledTimes(3);

        const texts = sqlMock.mock.calls.map(callSqlText).join('\n');
        expect(texts).toContain('DELETE FROM utility_entries');
        expect(texts).toContain('DELETE FROM requests');
        expect(texts).not.toContain('UPDATE requests');
    });

    it('soft-deletes a metered request (keeps it for quota)', async () => {
        sqlMock
            .mockResolvedValueOnce([{ id: 'req_2', metered_at: '2026-01-01T00:00:00.000Z', deleted_at: null }])
            .mockResolvedValueOnce([{ id: 'req_2' }]);

        const ok = await deleteRequest('req_2');

        expect(ok).toBe(true);
        expect(sqlMock).toHaveBeenCalledTimes(2);

        const texts = sqlMock.mock.calls.map(callSqlText).join('\n');
        expect(texts).toContain('UPDATE requests');
        expect(texts).not.toContain('DELETE FROM requests');
    });

    it('getMonthlyUsage counts metered requests (not mutable status)', async () => {
        sqlMock
            .mockResolvedValueOnce([{ count: '2' }])
            .mockResolvedValueOnce([{ subscription_status: 'free' }]);

        const usage = await getMonthlyUsage('acct_1');

        expect(usage).toEqual({ used: 2, limit: 3, plan: 'free' });
        expect(sqlMock).toHaveBeenCalledTimes(2);

        const usageQueryText = callSqlText(sqlMock.mock.calls[0]);
        expect(usageQueryText).toContain('metered_at');
        expect(usageQueryText).not.toContain("status != 'draft'");
    });

    it('getMonthlyUsage treats Teams org members as unlimited', async () => {
        sqlMock
            .mockResolvedValueOnce([{ count: '2' }])
            .mockResolvedValueOnce([{ subscription_status: 'free' }])
            .mockResolvedValueOnce([{ subscription_status: 'team' }]);

        const usage = await getMonthlyUsage('acct_1', 'org_1');

        expect(usage).toEqual({ used: 2, limit: 999999, plan: 'team' });
        expect(sqlMock).toHaveBeenCalledTimes(3);
    });

    it('claims a pre-seeded account with matching email and no auth user id', async () => {
        sqlMock
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{
                id: 'acct_demo',
                auth_user_id: null,
                email: 'demo.tc@utilitysheet.test',
                full_name: 'Demo TC',
            }])
            .mockResolvedValueOnce([{
                id: 'acct_demo',
                auth_user_id: 'stack_user_123',
                email: 'demo.tc@utilitysheet.test',
                full_name: 'Demo TC',
            }]);

        const result = await ensureAccountRecord(
            'stack_user_123',
            'demo.tc@utilitysheet.test',
            'Demo TC',
            null
        );

        expect(result).toEqual({
            account: expect.objectContaining({
                id: 'acct_demo',
                auth_user_id: 'stack_user_123',
            }),
            created: false,
        });
        expect(sqlMock).toHaveBeenCalledTimes(3);
        const texts = sqlMock.mock.calls.map(callSqlText).join('\n');
        expect(texts).toContain('auth_user_id IS NULL');
        expect(texts).toContain('UPDATE accounts');
        expect(texts).not.toContain('INSERT INTO accounts');
    });
});
