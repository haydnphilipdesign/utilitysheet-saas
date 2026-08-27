import { beforeEach, describe, expect, it, vi } from 'vitest';

const sqlMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/neon/db', () => ({ sql: sqlMock }));

import { setActiveOrganizationForMember } from '@/lib/neon/queries/organizations';

function callSqlText(call: unknown[]): string {
    const [strings] = call as [TemplateStringsArray];
    return Array.from(strings).join('');
}

describe('setActiveOrganizationForMember', () => {
    beforeEach(() => {
        sqlMock.mockReset();
    });

    it('guards the active pointer update with a live membership check', async () => {
        sqlMock.mockResolvedValueOnce([{ id: 'acct_1', active_organization_id: 'org_2' }]);

        const result = await setActiveOrganizationForMember('acct_1', 'org_2');

        expect(result).toEqual({ id: 'acct_1', active_organization_id: 'org_2' });
        const queryText = callSqlText(sqlMock.mock.calls[0]);
        expect(queryText).toContain('UPDATE accounts');
        expect(queryText).toContain('EXISTS');
        expect(queryText).toContain('organization_members');
        expect(queryText).toContain('om.organization_id');
        expect(queryText).toContain('om.account_id');
        expect(sqlMock.mock.calls[0].slice(1)).toEqual(['org_2', 'acct_1', 'org_2', 'acct_1']);
    });
});
