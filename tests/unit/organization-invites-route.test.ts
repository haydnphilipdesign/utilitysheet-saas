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
    getPendingOrganizationInvitesMock: vi.fn(),
    getOrganizationMemberRoleMock: vi.fn(),
    getOrganizationSeatUsageMock: vi.fn(),
    isOrganizationMemberByEmailMock: vi.fn(),
    createOrganizationInviteWithSeatGuardMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/stack/server', () => ({
    stackServerApp: {
        getUser: mocks.getUserMock,
    },
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
    createOrganizationInviteWithSeatGuard: mocks.createOrganizationInviteWithSeatGuardMock,
    getOrganizationById: mocks.getOrganizationByIdMock,
    getPendingOrganizationInvites: mocks.getPendingOrganizationInvitesMock,
    getOrganizationMemberRole: mocks.getOrganizationMemberRoleMock,
    getOrganizationSeatUsage: mocks.getOrganizationSeatUsageMock,
    getOrCreateAccount: mocks.getOrCreateAccountMock,
    isOrganizationMemberByEmail: mocks.isOrganizationMemberByEmailMock,
}));

import { GET, POST } from '@/app/api/organization/invites/route';

describe('/api/organization/invites', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mocks.getUserMock.mockResolvedValue({
            id: 'user_1',
            primaryEmail: 'admin@example.com',
            displayName: 'Org Admin',
        });
        mocks.getOrCreateAccountMock.mockResolvedValue({
            id: 'acct_admin',
            full_name: 'Org Admin',
            active_organization_id: 'org_1',
        });
        mocks.getOrganizationMemberRoleMock.mockResolvedValue('admin');
        mocks.getOrganizationByIdMock.mockResolvedValue({
            id: 'org_1',
            name: 'Acme Team',
            subscription_status: 'team',
            seat_quantity: 4,
        });
        mocks.getOrganizationSeatUsageMock.mockResolvedValue({ used: 1, pendingInvites: 1 });
        mocks.isOrganizationMemberByEmailMock.mockResolvedValue(false);
        mocks.createOrganizationInviteWithSeatGuardMock.mockResolvedValue({
            status: 'created',
            invite: {
                id: 'inv_1',
                token: 'tok_123',
                email: 'newuser@example.com',
                role: 'member',
            },
        });
        mocks.generateTokenMock.mockReturnValue('tok_123');
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
        mocks.getPendingOrganizationInvitesMock.mockResolvedValue([]);
    });

    it('GET requires admin org role', async () => {
        mocks.getOrganizationMemberRoleMock.mockResolvedValue('member');

        const response = await GET();
        expect(response.status).toBe(403);
        expect(mocks.getPendingOrganizationInvitesMock).not.toHaveBeenCalled();
    });

    it('GET lists pending invitations only for the authenticated active organization', async () => {
        mocks.getPendingOrganizationInvitesMock.mockResolvedValue([
            { id: 'inv_1', email: 'pending@example.com', role: 'member' },
        ]);

        const response = await GET();

        expect(response.status).toBe(200);
        expect(mocks.getPendingOrganizationInvitesMock).toHaveBeenCalledWith('org_1');
        expect(await response.json()).toEqual({
            invites: [{ id: 'inv_1', email: 'pending@example.com', role: 'member' }],
        });
    });

    it('reuses existing pending invite for same email', async () => {
        mocks.createOrganizationInviteWithSeatGuardMock.mockResolvedValue({
            status: 'existing',
            invite: {
                id: 'inv_existing',
                token: 'tok_existing',
                email: 'existing@example.com',
            },
        });

        const response = await POST(new Request('http://localhost/api/organization/invites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'existing@example.com' }),
        }));

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.reused).toBe(true);
        expect(body.inviteUrl).toBe('http://localhost:3000/invite/tok_existing');
        expect(mocks.sendOrganizationInviteEmailMock).not.toHaveBeenCalled();
    });

    it('blocks invite creation when no seats are available', async () => {
        mocks.getOrganizationSeatUsageMock.mockResolvedValue({ used: 2, pendingInvites: 2 });
        mocks.createOrganizationInviteWithSeatGuardMock.mockResolvedValue({ status: 'no_seat' });

        const response = await POST(new Request('http://localhost/api/organization/invites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'newuser@example.com' }),
        }));

        expect(response.status).toBe(409);
        const body = await response.json();
        expect(body.error).toBe('No seats available');
        expect(mocks.sendOrganizationInviteEmailMock).not.toHaveBeenCalled();
    });

    it('creates a new invite and lowercases the email', async () => {
        const response = await POST(new Request('http://localhost/api/organization/invites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'NewUser@Example.COM' }),
        }));

        expect(response.status).toBe(200);
        expect(mocks.createOrganizationInviteWithSeatGuardMock).toHaveBeenCalledWith(
            expect.objectContaining({
                organizationId: 'org_1',
                invitedByAccountId: 'acct_admin',
                email: 'newuser@example.com',
            })
        );
        const body = await response.json();
        expect(body.emailSent).toBe(true);
        expect(body.inviteUrl).toBe('http://localhost:3000/invite/tok_123');
    });

    it('returns success even when sending invite email fails', async () => {
        mocks.sendOrganizationInviteEmailMock.mockRejectedValue(new Error('resend failed'));

        const response = await POST(new Request('http://localhost/api/organization/invites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'newuser@example.com' }),
        }));

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.emailSent).toBe(false);
    });
});
