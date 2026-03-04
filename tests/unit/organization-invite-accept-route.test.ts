import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getUserMock: vi.fn(),
    getOrCreateAccountMock: vi.fn(),
    getOrganizationInviteByTokenMock: vi.fn(),
    getOrganizationByIdMock: vi.fn(),
    acceptOrganizationInviteWithSeatGuardMock: vi.fn(),
    setActiveOrganizationMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/stack/server', () => ({
    stackServerApp: {
        getUser: mocks.getUserMock,
    },
}));

vi.mock('@/lib/neon/queries', () => ({
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
