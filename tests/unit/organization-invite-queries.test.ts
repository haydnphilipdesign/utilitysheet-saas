import { beforeEach, describe, expect, it, vi } from 'vitest';

const sqlMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/neon/db', () => ({
    sql: sqlMock,
}));

import {
    cancelPendingOrganizationInvite,
    getOrganizationInviteForOrganization,
    getUnacceptedOrganizationInvites,
    renewOrganizationInviteWithSeatGuard,
} from '@/lib/neon/queries/organizations';

function callSqlText(call: unknown[]): string {
    const [strings] = call as [TemplateStringsArray];
    return Array.from(strings).join('');
}

function callSqlValues(call: unknown[]): unknown[] {
    return call.slice(1);
}

const renewal = {
    inviteId: 'inv_1',
    organizationId: 'org_1',
    token: 'tok_rotated',
    invitedByAccountId: 'acct_admin',
    expiresAt: new Date('2026-07-24T12:00:00.000Z'),
};

describe('unaccepted organization invitation queries', () => {
    beforeEach(() => {
        sqlMock.mockReset();
    });

    it('scopes invite lookup to both invite and organization, and never returns an accepted one', async () => {
        sqlMock.mockResolvedValueOnce([{ id: 'inv_1', organization_id: 'org_1' }]);

        await getOrganizationInviteForOrganization('inv_1', 'org_1');

        const queryText = callSqlText(sqlMock.mock.calls[0]);
        expect(queryText).toContain('id = ');
        expect(queryText).toContain('organization_id = ');
        expect(queryText).toContain('accepted_at IS NULL');
        expect(callSqlValues(sqlMock.mock.calls[0])).toEqual(['inv_1', 'org_1']);
    });

    it('lists pending and expired invitations for one organization, each person once', async () => {
        sqlMock.mockResolvedValueOnce([]);

        await getUnacceptedOrganizationInvites('org_1');

        const queryText = callSqlText(sqlMock.mock.calls[0]);
        expect(queryText).toContain('i.organization_id = ');
        expect(queryText).toContain('i.accepted_at IS NULL');
        expect(queryText).toContain("THEN 'pending' ELSE 'expired' END AS status");
        // An expired row gives way to a newer invitation or to membership.
        expect(queryText).toContain('lower(newer.email) = lower(i.email)');
        expect(queryText).toContain('FROM organization_members om');
        expect(queryText).not.toContain('token');
        expect(callSqlValues(sqlMock.mock.calls[0])).toEqual(['org_1']);
    });

    it('keeps renewal and cancellation organization-scoped and limited to unaccepted invitations', async () => {
        sqlMock
            .mockResolvedValueOnce([{ invite: { id: 'inv_1', token: 'tok_rotated' }, found: true, was_pending: true }])
            .mockResolvedValueOnce([{ id: 'inv_1' }]);

        await renewOrganizationInviteWithSeatGuard(renewal);
        await cancelPendingOrganizationInvite('inv_1', 'org_1');

        for (const call of sqlMock.mock.calls) {
            const queryText = callSqlText(call);
            expect(queryText).toContain('id = ');
            expect(queryText).toContain('organization_id = ');
            expect(queryText).toContain('accepted_at IS NULL');
            const values = callSqlValues(call);
            expect(values).toContain('inv_1');
            expect(values).toContain('org_1');
        }
    });

    it('locks the workspace and checks seats before an expired invitation is renewed', async () => {
        sqlMock.mockResolvedValueOnce([{ invite: null, found: true, was_pending: false }]);

        const result = await renewOrganizationInviteWithSeatGuard(renewal);

        const queryText = callSqlText(sqlMock.mock.calls[0]);
        expect(queryText).toContain('FOR UPDATE');
        expect(queryText).toContain('target.is_pending');
        expect(queryText).toContain('(seat_usage.used + seat_usage.pending) < organization_row.seat_quantity');
        expect(queryText).toContain('lower(other.email) = lower(target.email)');
        expect(result).toEqual({ status: 'no_seat' });
    });

    it('reports what renewal did', async () => {
        sqlMock
            .mockResolvedValueOnce([{ invite: { id: 'inv_1' }, found: true, was_pending: false }])
            .mockResolvedValueOnce([{ invite: '{"id":"inv_1"}', found: true, was_pending: true }])
            .mockResolvedValueOnce([{ invite: null, found: false, was_pending: false }]);

        expect(await renewOrganizationInviteWithSeatGuard(renewal))
            .toEqual({ status: 'renewed', invite: { id: 'inv_1' }, wasExpired: true });
        expect(await renewOrganizationInviteWithSeatGuard(renewal))
            .toEqual({ status: 'renewed', invite: { id: 'inv_1' }, wasExpired: false });
        expect(await renewOrganizationInviteWithSeatGuard(renewal)).toEqual({ status: 'not_found' });
    });
});
