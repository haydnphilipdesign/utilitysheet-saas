import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getUserMock: vi.fn(),
    getOrCreateAccountMock: vi.fn(),
    getOrganizationInviteSummaryByTokenMock: vi.fn(),
    getOrganizationMemberRoleMock: vi.fn(),
    checkRateLimitMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/stack/server', () => ({ stackServerApp: { getUser: mocks.getUserMock } }));
vi.mock('@/lib/network/client-ip', () => ({ getClientIpOrNull: () => '203.0.113.9' }));
vi.mock('@/lib/rate-limit', () => ({
    organizationInviteLookupRatelimit: {},
    checkRateLimit: mocks.checkRateLimitMock,
    getRateLimitHeaders: () => ({}),
}));
vi.mock('@/lib/neon/queries', () => ({
    getOrCreateAccount: mocks.getOrCreateAccountMock,
    getOrganizationInviteSummaryByToken: mocks.getOrganizationInviteSummaryByTokenMock,
    getOrganizationMemberRole: mocks.getOrganizationMemberRoleMock,
}));

import { GET } from '@/app/api/organization/invites/lookup/route';

const openInvite = () => ({
    id: 'inv_1',
    organization_id: 'org_1',
    email: 'Invitee@Example.com',
    role: 'member',
    token: 'tok_1',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    accepted_at: null,
    organization_name: 'Riverbend Transaction Services',
    organization_subscription_status: 'team',
    invited_by_name: 'Pat Lee',
});

const lookup = (token = 'tok_1') =>
    GET(new Request(`http://localhost/api/organization/invites/lookup?token=${token}`));

describe('GET /api/organization/invites/lookup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.checkRateLimitMock.mockResolvedValue({ success: true });
        mocks.getUserMock.mockResolvedValue(null);
        mocks.getOrganizationInviteSummaryByTokenMock.mockResolvedValue(openInvite());
        mocks.getOrganizationMemberRoleMock.mockResolvedValue(null);
    });

    it('describes an open invitation to a signed-out visitor without creating an account', async () => {
        const response = await lookup();

        expect(response.status).toBe(200);
        expect(response.headers.get('Cache-Control')).toBe('private, no-store');
        expect(await response.json()).toMatchObject({
            status: 'open',
            workspaceName: 'Riverbend Transaction Services',
            invitedByName: 'Pat Lee',
            invitedEmail: 'Invitee@Example.com',
            role: 'member',
            workspaceOnTeams: true,
            viewer: { signedIn: false, email: null, emailMatches: false, isMember: false, organizationId: null },
        });
        expect(mocks.getOrCreateAccountMock).not.toHaveBeenCalled();
    });

    it('never returns the token or the workspace identifier to a non-member', async () => {
        const body = JSON.stringify(await (await lookup()).json());

        expect(body).not.toContain('tok_1');
        expect(body).not.toContain('org_1');
    });

    it('matches the signed-in address without regard to case', async () => {
        mocks.getUserMock.mockResolvedValue({ id: 'user_1', primaryEmail: 'invitee@example.com' });
        mocks.getOrCreateAccountMock.mockResolvedValue({ id: 'acct_1', email: 'invitee@example.com' });

        const body = await (await lookup()).json();

        expect(body.viewer).toEqual({
            signedIn: true,
            email: 'invitee@example.com',
            emailMatches: true,
            isMember: false,
            organizationId: null,
        });
    });

    it('reports a different signed-in address as not matching', async () => {
        mocks.getUserMock.mockResolvedValue({ id: 'user_2', primaryEmail: 'someone.else@example.com' });
        mocks.getOrCreateAccountMock.mockResolvedValue({ id: 'acct_2', email: 'someone.else@example.com' });

        const body = await (await lookup()).json();

        expect(body.viewer).toMatchObject({ signedIn: true, email: 'someone.else@example.com', emailMatches: false });
    });

    it('tells a member which workspace to open after the invitation was used', async () => {
        mocks.getOrganizationInviteSummaryByTokenMock.mockResolvedValue({
            ...openInvite(),
            accepted_at: new Date().toISOString(),
        });
        mocks.getUserMock.mockResolvedValue({ id: 'user_1', primaryEmail: 'invitee@example.com' });
        mocks.getOrCreateAccountMock.mockResolvedValue({ id: 'acct_1', email: 'invitee@example.com' });
        mocks.getOrganizationMemberRoleMock.mockResolvedValue('member');

        const body = await (await lookup()).json();

        expect(body.status).toBe('accepted');
        expect(body.viewer).toMatchObject({ isMember: true, organizationId: 'org_1' });
        expect(mocks.getOrganizationMemberRoleMock).toHaveBeenCalledWith('org_1', 'acct_1');
    });

    it('reports an expired invitation', async () => {
        mocks.getOrganizationInviteSummaryByTokenMock.mockResolvedValue({
            ...openInvite(),
            expires_at: new Date(Date.now() - 60_000).toISOString(),
        });

        expect((await (await lookup()).json()).status).toBe('expired');
    });

    it('returns not found for an unknown or missing token', async () => {
        mocks.getOrganizationInviteSummaryByTokenMock.mockResolvedValue(null);

        expect((await lookup('nope')).status).toBe(404);
        expect((await lookup('')).status).toBe(404);
    });

    it('refuses when the rate limit is reached, before reading anything', async () => {
        mocks.checkRateLimitMock.mockResolvedValue({ success: false });

        const response = await lookup();

        expect(response.status).toBe(429);
        expect(mocks.getOrganizationInviteSummaryByTokenMock).not.toHaveBeenCalled();
    });
});
