import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getUserMock: vi.fn(),
    getOrCreateAccountMock: vi.fn(),
    getOpenOrganizationInvitesForEmailMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/stack/server', () => ({ stackServerApp: { getUser: mocks.getUserMock } }));
vi.mock('@/lib/neon/queries', () => ({
    getOrCreateAccount: mocks.getOrCreateAccountMock,
    getOpenOrganizationInvitesForEmail: mocks.getOpenOrganizationInvitesForEmailMock,
}));

import { GET } from '@/app/api/organization/invites/mine/route';

describe('GET /api/organization/invites/mine', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUserMock.mockResolvedValue({
            id: 'user_1',
            primaryEmail: 'invitee@example.com',
            primaryEmailVerified: true,
        });
        mocks.getOrCreateAccountMock.mockResolvedValue({ id: 'acct_1', email: 'invitee@example.com' });
        mocks.getOpenOrganizationInvitesForEmailMock.mockResolvedValue([{
            id: 'inv_1',
            organization_id: 'org_1',
            email: 'invitee@example.com',
            token: 'tok_1',
            expires_at: '2026-10-14T12:00:00.000Z',
            organization_name: 'Riverbend Transaction Services',
            invited_by_name: 'Pat Lee',
        }]);
    });

    it('requires sign-in', async () => {
        mocks.getUserMock.mockResolvedValue(null);

        expect((await GET()).status).toBe(401);
    });

    it('shows nothing to an address that has not been verified', async () => {
        mocks.getUserMock.mockResolvedValue({
            id: 'user_1',
            primaryEmail: 'invitee@example.com',
            primaryEmailVerified: false,
        });

        const response = await GET();

        expect(await response.json()).toEqual({ invitations: [] });
        expect(mocks.getOpenOrganizationInvitesForEmailMock).not.toHaveBeenCalled();
    });

    it('lists open invitations for the verified sign-in address only', async () => {
        const response = await GET();

        expect(response.status).toBe(200);
        expect(mocks.getOpenOrganizationInvitesForEmailMock).toHaveBeenCalledWith('invitee@example.com', 'acct_1');
        expect(await response.json()).toEqual({
            invitations: [{
                id: 'inv_1',
                workspaceName: 'Riverbend Transaction Services',
                invitedByName: 'Pat Lee',
                expiresAt: '2026-10-14T12:00:00.000Z',
                url: '/invite/tok_1',
            }],
        });
    });
});
