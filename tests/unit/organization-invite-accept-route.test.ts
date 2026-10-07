import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getUserMock: vi.fn(),
    getOrCreateAccountMock: vi.fn(),
    getOrganizationInviteByTokenMock: vi.fn(),
    getOrganizationByIdMock: vi.fn(),
    acceptOrganizationInviteWithSeatGuardMock: vi.fn(),
    setActiveOrganizationMock: vi.fn(),
    getAccountByIdMock: vi.fn(),
    getOrganizationMemberRoleMock: vi.fn(),
    sendOrganizationInviteAcceptedEmailMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/stack/server', () => ({
    stackServerApp: {
        getUser: mocks.getUserMock,
    },
}));

vi.mock('@/lib/email/email-service', () => ({
    sendOrganizationInviteAcceptedEmail: mocks.sendOrganizationInviteAcceptedEmailMock,
}));

vi.mock('@/lib/neon/queries', () => ({
    getAccountById: mocks.getAccountByIdMock,
    getOrganizationMemberRole: mocks.getOrganizationMemberRoleMock,
    acceptOrganizationInviteWithSeatGuard: mocks.acceptOrganizationInviteWithSeatGuardMock,
    getOrganizationById: mocks.getOrganizationByIdMock,
    getOrganizationInviteByToken: mocks.getOrganizationInviteByTokenMock,
    getOrCreateAccount: mocks.getOrCreateAccountMock,
    setActiveOrganization: mocks.setActiveOrganizationMock,
}));

import { POST } from '@/app/api/organization/invites/accept/route';

describe('POST /api/organization/invites/accept', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mocks.getUserMock.mockResolvedValue({
            id: 'user_1',
            primaryEmail: 'invitee@example.com',
            displayName: 'Invitee',
        });
        mocks.getOrCreateAccountMock.mockResolvedValue({
            id: 'acct_1',
            email: 'invitee@example.com',
        });
        mocks.getOrganizationInviteByTokenMock.mockResolvedValue({
            id: 'inv_1',
            organization_id: 'org_1',
            email: 'invitee@example.com',
            role: 'member',
            accepted_at: null,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
        });
        mocks.getOrganizationByIdMock.mockResolvedValue({
            id: 'org_1',
            subscription_status: 'team',
            seat_quantity: 4,
        });
        mocks.acceptOrganizationInviteWithSeatGuardMock.mockResolvedValue({
            status: 'accepted',
            memberInserted: true,
        });
        mocks.setActiveOrganizationMock.mockResolvedValue({ id: 'acct_1' });
        mocks.getOrganizationMemberRoleMock.mockResolvedValue('admin');
        mocks.getAccountByIdMock.mockResolvedValue({ id: 'acct_admin', email: 'admin@example.com' });
        mocks.sendOrganizationInviteAcceptedEmailMock.mockResolvedValue({ success: true });
    });

    const accept = () => POST(new Request('http://localhost/api/organization/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'tok_1' }),
    }));
    const inviteFrom = (invitedBy: string | null) => ({
        id: 'inv_1',
        organization_id: 'org_1',
        email: 'invitee@example.com',
        role: 'member',
        accepted_at: null,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        invited_by_account_id: invitedBy,
    });

    it('tells the admin who sent the invitation that it was accepted', async () => {
        mocks.getOrganizationInviteByTokenMock.mockResolvedValue(inviteFrom('acct_admin'));
        mocks.getOrganizationByIdMock.mockResolvedValue({ id: 'org_1', name: 'Acme Team', subscription_status: 'team' });

        expect((await accept()).status).toBe(200);
        expect(mocks.getOrganizationMemberRoleMock).toHaveBeenCalledWith('org_1', 'acct_admin');
        expect(mocks.sendOrganizationInviteAcceptedEmailMock).toHaveBeenCalledWith({
            toEmail: 'admin@example.com',
            organizationName: 'Acme Team',
            memberName: 'Invitee',
            memberEmail: 'invitee@example.com',
        });
    });

    it('does not email an inviter who has left the workspace, or when none is recorded', async () => {
        mocks.getOrganizationInviteByTokenMock.mockResolvedValue(inviteFrom('acct_admin'));
        mocks.getOrganizationMemberRoleMock.mockResolvedValue(null);
        expect((await accept()).status).toBe(200);

        mocks.getOrganizationInviteByTokenMock.mockResolvedValue(inviteFrom(null));
        expect((await accept()).status).toBe(200);

        expect(mocks.sendOrganizationInviteAcceptedEmailMock).not.toHaveBeenCalled();
    });

    it('still joins when the email to the inviter fails', async () => {
        mocks.getOrganizationInviteByTokenMock.mockResolvedValue(inviteFrom('acct_admin'));
        mocks.sendOrganizationInviteAcceptedEmailMock.mockRejectedValue(new Error('delivery failed'));

        const response = await accept();

        expect(response.status).toBe(200);
        expect(mocks.setActiveOrganizationMock).toHaveBeenCalledWith('acct_1', 'org_1');
    });

    it('sends no email when nobody joined', async () => {
        mocks.getOrganizationInviteByTokenMock.mockResolvedValue(inviteFrom('acct_admin'));
        mocks.acceptOrganizationInviteWithSeatGuardMock.mockResolvedValue({ status: 'no_seat' });

        expect((await accept()).status).toBe(409);
        expect(mocks.sendOrganizationInviteAcceptedEmailMock).not.toHaveBeenCalled();
    });

    it('requires auth', async () => {
        mocks.getUserMock.mockResolvedValue(null);

        const response = await POST(new Request('http://localhost/api/organization/invites/accept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: 'tok_1' }),
        }));

        expect(response.status).toBe(401);
    });

    it('rejects missing invite token', async () => {
        const response = await POST(new Request('http://localhost/api/organization/invites/accept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        }));

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Invite token is required');
    });

    it('rejects expired invites', async () => {
        mocks.getOrganizationInviteByTokenMock.mockResolvedValue({
            id: 'inv_1',
            organization_id: 'org_1',
            email: 'invitee@example.com',
            role: 'member',
            accepted_at: null,
            expires_at: new Date(Date.now() - 60_000).toISOString(),
        });

        const response = await POST(new Request('http://localhost/api/organization/invites/accept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: 'tok_1' }),
        }));

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Invite expired');
    });

    it('rejects email mismatch', async () => {
        mocks.getOrCreateAccountMock.mockResolvedValue({
            id: 'acct_1',
            email: 'different@example.com',
        });

        const response = await POST(new Request('http://localhost/api/organization/invites/accept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: 'tok_1' }),
        }));

        expect(response.status).toBe(403);
        const body = await response.json();
        expect(body.error).toBe('Email mismatch');
    });

    it('rejects when no seats remain', async () => {
        mocks.acceptOrganizationInviteWithSeatGuardMock.mockResolvedValue({ status: 'no_seat' });

        const response = await POST(new Request('http://localhost/api/organization/invites/accept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: 'tok_1' }),
        }));

        expect(response.status).toBe(409);
        const body = await response.json();
        expect(body.error).toBe('No seats available');
        expect(mocks.setActiveOrganizationMock).not.toHaveBeenCalled();
    });

    it('adds membership, activates org, and marks invite accepted', async () => {
        const response = await POST(new Request('http://localhost/api/organization/invites/accept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: 'tok_1' }),
        }));

        expect(response.status).toBe(200);
        expect(mocks.acceptOrganizationInviteWithSeatGuardMock).toHaveBeenCalledWith({
            organizationId: 'org_1',
            inviteId: 'inv_1',
            accountId: 'acct_1',
            role: 'member',
        });
        expect(mocks.setActiveOrganizationMock).toHaveBeenCalledWith('acct_1', 'org_1');
    });

    it('returns already accepted when the atomic accept reports race completion', async () => {
        mocks.acceptOrganizationInviteWithSeatGuardMock.mockResolvedValue({ status: 'already_accepted' });

        const response = await POST(new Request('http://localhost/api/organization/invites/accept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: 'tok_1' }),
        }));

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Invite already accepted');
    });
});
