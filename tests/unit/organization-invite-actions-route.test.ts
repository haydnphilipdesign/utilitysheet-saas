import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getUserMock: vi.fn(),
    generateTokenMock: vi.fn(),
    sendOrganizationInviteEmailMock: vi.fn(),
    checkRateLimitMock: vi.fn(),
    getRateLimitHeadersMock: vi.fn(),
    isRateLimitUnavailableMock: vi.fn(),
    getClientIpOrNullMock: vi.fn(),
    getOrCreateAccountMock: vi.fn(),
    getOrganizationByIdMock: vi.fn(),
    getOrganizationMemberRoleMock: vi.fn(),
    getOrganizationInviteForOrganizationMock: vi.fn(),
    refreshPendingOrganizationInviteMock: vi.fn(),
    cancelPendingOrganizationInviteMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/stack/server', () => ({
    stackServerApp: { getUser: mocks.getUserMock },
}));

vi.mock('@/lib/neon/db', () => ({
    generateToken: mocks.generateTokenMock,
}));

vi.mock('@/lib/email/email-service', () => ({
    sendOrganizationInviteEmail: mocks.sendOrganizationInviteEmailMock,
}));

vi.mock('@/lib/network/client-ip', () => ({
    getClientIpOrNull: mocks.getClientIpOrNullMock,
}));

vi.mock('@/lib/rate-limit', () => ({
    organizationInviteRatelimit: {},
    checkRateLimit: mocks.checkRateLimitMock,
    getRateLimitHeaders: mocks.getRateLimitHeadersMock,
    isRateLimitUnavailable: mocks.isRateLimitUnavailableMock,
}));

vi.mock('@/lib/neon/queries', () => ({
    getOrCreateAccount: mocks.getOrCreateAccountMock,
    getOrganizationById: mocks.getOrganizationByIdMock,
    getOrganizationMemberRole: mocks.getOrganizationMemberRoleMock,
    getOrganizationInviteForOrganization: mocks.getOrganizationInviteForOrganizationMock,
    refreshPendingOrganizationInvite: mocks.refreshPendingOrganizationInviteMock,
    cancelPendingOrganizationInvite: mocks.cancelPendingOrganizationInviteMock,
}));

import { DELETE, PATCH } from '@/app/api/organization/invites/[inviteId]/route';

const routeContext = { params: Promise.resolve({ inviteId: 'inv_1' }) };

describe('/api/organization/invites/[inviteId]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUserMock.mockResolvedValue({
            id: 'user_admin',
            primaryEmail: 'admin@example.com',
            displayName: 'Admin User',
        });
        mocks.getOrCreateAccountMock.mockResolvedValue({
            id: 'acct_admin',
            full_name: 'Admin User',
            active_organization_id: 'org_1',
        });
        mocks.getOrganizationMemberRoleMock.mockResolvedValue('admin');
        mocks.getOrganizationByIdMock.mockResolvedValue({
            id: 'org_1',
            name: 'Acme Workspace',
            subscription_status: 'team',
        });
        mocks.getOrganizationInviteForOrganizationMock.mockResolvedValue({
            id: 'inv_1',
            organization_id: 'org_1',
            email: 'invitee@example.com',
            role: 'member',
            expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        });
        mocks.generateTokenMock.mockReturnValue('tok_rotated');
        mocks.refreshPendingOrganizationInviteMock.mockResolvedValue({
            id: 'inv_1',
            organization_id: 'org_1',
            email: 'invitee@example.com',
            role: 'member',
            token: 'tok_rotated',
            expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        });
        mocks.cancelPendingOrganizationInviteMock.mockResolvedValue(true);
        mocks.sendOrganizationInviteEmailMock.mockResolvedValue({ success: true });
        mocks.getClientIpOrNullMock.mockReturnValue('127.0.0.1');
        mocks.checkRateLimitMock.mockResolvedValue({
            success: true,
            reason: 'ok',
            limit: 10,
            remaining: 9,
            reset: 1000,
        });
        mocks.getRateLimitHeadersMock.mockReturnValue({});
        mocks.isRateLimitUnavailableMock.mockReturnValue(false);
    });

    it('rejects resend for ordinary members', async () => {
        mocks.getOrganizationMemberRoleMock.mockResolvedValue('member');

        const response = await PATCH(new Request('http://localhost/api/organization/invites/inv_1', {
            method: 'PATCH',
        }), routeContext);

        expect(response.status).toBe(403);
        expect(mocks.refreshPendingOrganizationInviteMock).not.toHaveBeenCalled();
    });

    it('does not reveal or mutate an invite from another organization', async () => {
        mocks.getOrganizationInviteForOrganizationMock.mockResolvedValue(null);

        const response = await PATCH(new Request('http://localhost/api/organization/invites/inv_other', {
            method: 'PATCH',
        }), { params: Promise.resolve({ inviteId: 'inv_other' }) });

        expect(response.status).toBe(404);
        expect(mocks.getOrganizationInviteForOrganizationMock).toHaveBeenCalledWith('inv_other', 'org_1');
        expect(mocks.refreshPendingOrganizationInviteMock).not.toHaveBeenCalled();
        expect(mocks.sendOrganizationInviteEmailMock).not.toHaveBeenCalled();
    });

    it('requires the active workspace to be on Teams', async () => {
        mocks.getOrganizationByIdMock.mockResolvedValue({
            id: 'org_1',
            name: 'Acme Workspace',
            subscription_status: 'free',
        });

        const response = await PATCH(new Request('http://localhost/api/organization/invites/inv_1', {
            method: 'PATCH',
        }), routeContext);

        expect(response.status).toBe(402);
        expect(mocks.refreshPendingOrganizationInviteMock).not.toHaveBeenCalled();
    });

    it('rotates the pending invite token and resends the refreshed link', async () => {
        const response = await PATCH(new Request('http://localhost/api/organization/invites/inv_1', {
            method: 'PATCH',
        }), routeContext);

        expect(response.status).toBe(200);
        expect(mocks.refreshPendingOrganizationInviteMock).toHaveBeenCalledWith({
            inviteId: 'inv_1',
            organizationId: 'org_1',
            invitedByAccountId: 'acct_admin',
            token: 'tok_rotated',
            expiresAt: expect.any(Date),
        });
        expect(mocks.sendOrganizationInviteEmailMock).toHaveBeenCalledWith(expect.objectContaining({
            toEmail: 'invitee@example.com',
            organizationName: 'Acme Workspace',
            inviteUrl: 'http://localhost:3000/invite/tok_rotated',
        }));
        const body = await response.json();
        expect(body.emailSent).toBe(true);
        expect(body.invite).not.toHaveProperty('token');
        expect(body.inviteUrl).toBe('http://localhost:3000/invite/tok_rotated');
    });

    it('returns success when the refreshed invite email cannot be delivered', async () => {
        mocks.sendOrganizationInviteEmailMock.mockRejectedValue(new Error('delivery failed'));

        const response = await PATCH(new Request('http://localhost/api/organization/invites/inv_1', {
            method: 'PATCH',
        }), routeContext);

        expect(response.status).toBe(200);
        expect((await response.json()).emailSent).toBe(false);
    });

    it('cancels only a pending invite scoped to the active organization', async () => {
        const response = await DELETE(new Request('http://localhost/api/organization/invites/inv_1', {
            method: 'DELETE',
        }), routeContext);

        expect(response.status).toBe(200);
        expect(mocks.getOrganizationInviteForOrganizationMock).toHaveBeenCalledWith('inv_1', 'org_1');
        expect(mocks.cancelPendingOrganizationInviteMock).toHaveBeenCalledWith('inv_1', 'org_1');
        expect(await response.json()).toEqual({ success: true });
    });

    it('does not cancel an invite from another organization', async () => {
        mocks.getOrganizationInviteForOrganizationMock.mockResolvedValue(null);

        const response = await DELETE(new Request('http://localhost/api/organization/invites/inv_other', {
            method: 'DELETE',
        }), { params: Promise.resolve({ inviteId: 'inv_other' }) });

        expect(response.status).toBe(404);
        expect(mocks.getOrganizationInviteForOrganizationMock).toHaveBeenCalledWith('inv_other', 'org_1');
        expect(mocks.cancelPendingOrganizationInviteMock).not.toHaveBeenCalled();
    });
});
