import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ sql: vi.fn() }));

vi.mock('@/lib/neon/db', () => ({ sql: mocks.sql }));

import { ensureAccountRecord } from '@/lib/neon/queries/accounts';

describe('account activation closure guards', () => {
    beforeEach(() => vi.clearAllMocks());

    it.each(['closing', 'closed'])('refuses to activate an existing %s auth identity', async (closureStatus) => {
        mocks.sql.mockResolvedValueOnce([{
            id: 'closed_account',
            auth_user_id: 'stack_old',
            email: 'closed+closed_account@closed.utilitysheet.invalid',
            closure_status: closureStatus,
        }]);

        await expect(ensureAccountRecord('stack_old', 'owner@example.com')).resolves.toEqual({
            account: null,
            created: false,
            closureStatus,
        });
        expect(mocks.sql).toHaveBeenCalledTimes(1);
    });

    it('excludes non-active seed rows and permits the former email to create a new account', async () => {
        mocks.sql
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: 'new_account', auth_user_id: 'stack_new', email: 'owner@example.com' }]);

        const result = await ensureAccountRecord('stack_new', 'owner@example.com');

        expect(result).toMatchObject({ account: { id: 'new_account' }, created: true });
        const claimableQuery = (mocks.sql.mock.calls[1][0] as TemplateStringsArray).join(' ');
        expect(claimableQuery).toContain("COALESCE(to_jsonb(accounts) ->> 'closure_status', 'active') = 'active'");
    });
});

