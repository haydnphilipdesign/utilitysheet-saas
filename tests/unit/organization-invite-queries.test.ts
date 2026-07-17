import { beforeEach, describe, expect, it, vi } from 'vitest';

const sqlMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/neon/db', () => ({
    sql: sqlMock,
}));

import {
    cancelPendingOrganizationInvite,
    getOrganizationInviteForOrganization,
    refreshPendingOrganizationInvite,
} from '@/lib/neon/queries/organizations';

function callSqlText(call: unknown[]): string {
    const [strings] = call as [TemplateStringsArray];
    return Array.from(strings).join('');
}

function callSqlValues(call: unknown[]): unknown[] {
    return call.slice(1);
}

describe('pending organization invitation queries', () => {
    beforeEach(() => {
        sqlMock.mockReset();
    });

    it('scopes pending invite lookup to both invite and organization', async () => {
        sqlMock.mockResolvedValueOnce([{ id: 'inv_1', organization_id: 'org_1' }]);

        await getOrganizationInviteForOrganization('inv_1', 'org_1');

        const queryText = callSqlText(sqlMock.mock.calls[0]);
        expect(queryText).toContain('id = ');
        expect(queryText).toContain('organization_id = ');
        expect(queryText).toContain('accepted_at IS NULL');
        expect(queryText).toContain('expires_at > NOW()');
        expect(callSqlValues(sqlMock.mock.calls[0])).toEqual(['inv_1', 'org_1']);
    });

    it('keeps resend and cancellation mutations organization-scoped', async () => {
        sqlMock
            .mockResolvedValueOnce([{ id: 'inv_1', token: 'tok_rotated' }])
            .mockResolvedValueOnce([{ id: 'inv_1' }]);

        await refreshPendingOrganizationInvite({
            inviteId: 'inv_1',
            organizationId: 'org_1',
            token: 'tok_rotated',
            invitedByAccountId: 'acct_admin',
            expiresAt: new Date('2026-07-24T12:00:00.000Z'),
        });
        await cancelPendingOrganizationInvite('inv_1', 'org_1');

        for (const call of sqlMock.mock.calls) {
            const queryText = callSqlText(call);
            expect(queryText).toContain('id = ');
            expect(queryText).toContain('organization_id = ');
            expect(queryText).toContain('accepted_at IS NULL');
            expect(queryText).toContain('expires_at > NOW()');
            const values = callSqlValues(call);
            expect(values).toContain('inv_1');
            expect(values).toContain('org_1');
        }
    });
});
