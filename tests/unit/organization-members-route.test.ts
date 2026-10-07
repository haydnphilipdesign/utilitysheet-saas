import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getUserMock: vi.fn(),
    getOrCreateAccountMock: vi.fn(),
    getOrganizationByIdMock: vi.fn(),
    getOrganizationMemberRoleMock: vi.fn(),
    getOrganizationMembersMock: vi.fn(),
    getOrganizationSeatUsageMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/stack/server', () => ({ stackServerApp: { getUser: mocks.getUserMock } }));
vi.mock('@/lib/neon/queries/organizations', () => ({
    getOrganizationById: mocks.getOrganizationByIdMock,
    getOrganizationMemberRole: mocks.getOrganizationMemberRoleMock,
}));
vi.mock('@/lib/neon/queries', () => ({
    getOrCreateAccount: mocks.getOrCreateAccountMock,
    getOrganizationById: mocks.getOrganizationByIdMock,
    getOrganizationMemberRole: mocks.getOrganizationMemberRoleMock,
    getOrganizationMembers: mocks.getOrganizationMembersMock,
    getOrganizationSeatUsage: mocks.getOrganizationSeatUsageMock,
}));

import { GET } from '@/app/api/organization/members/route';

describe('GET /api/organization/members', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUserMock.mockResolvedValue({ id: 'user_1', primaryEmail: 'member@example.com' });
        mocks.getOrCreateAccountMock.mockResolvedValue({ id: 'acct_1', active_organization_id: 'org_1' });
        mocks.getOrganizationMemberRoleMock.mockResolvedValue('member');
        mocks.getOrganizationByIdMock.mockResolvedValue({
            id: 'org_1',
            name: 'Riverbend Transaction Services',
            subscription_status: 'team',
            seat_quantity: 4,
            subscription_cancel_at: null,
            stripe_customer_id: 'cus_synthetic',
            subscription_id: 'sub_synthetic',
        });
        mocks.getOrganizationMembersMock.mockResolvedValue([
            { account_id: 'acct_1', email: 'member@example.com', full_name: 'Sam', member_role: 'member' },
        ]);
        mocks.getOrganizationSeatUsageMock.mockResolvedValue({ used: 1, pendingInvites: 0 });
    });

    it('gives a member the workspace, people and seats without the billing identifiers', async () => {
        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.organization).toEqual({
            id: 'org_1',
            name: 'Riverbend Transaction Services',
            subscription_status: 'team',
            seat_quantity: 4,
            subscription_cancel_at: null,
        });
        expect(JSON.stringify(body)).not.toMatch(/cus_synthetic|sub_synthetic/);
        expect(body.role).toBe('member');
        expect(body.seatUsage).toEqual({ used: 1, pendingInvites: 0 });
    });

    it('keeps the billing identifiers from admins too, since no screen uses them', async () => {
        mocks.getOrganizationMemberRoleMock.mockResolvedValue('admin');

        expect(JSON.stringify(await (await GET()).json())).not.toMatch(/cus_synthetic|sub_synthetic/);
    });

    it('refuses someone who is not a member of their active workspace', async () => {
        mocks.getOrganizationMemberRoleMock.mockResolvedValue(null);

        expect((await GET()).status).toBe(403);
    });
});
