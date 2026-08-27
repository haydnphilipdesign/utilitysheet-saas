import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getOrCreateAccount: vi.fn(),
    getUser: vi.fn(),
    setActiveOrganizationForMember: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/stack/server', () => ({
    stackServerApp: { getUser: mocks.getUser },
}));

vi.mock('@/lib/neon/queries', () => ({
    getOrCreateAccount: mocks.getOrCreateAccount,
    setActiveOrganizationForMember: mocks.setActiveOrganizationForMember,
}));

import { POST } from '@/app/api/account/active-organization/route';

function request(body: unknown) {
    return new Request('http://localhost/api/account/active-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('POST /api/account/active-organization', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUser.mockResolvedValue({
            id: 'user_1',
            primaryEmail: 'member@example.com',
            displayName: 'Member',
        });
        mocks.getOrCreateAccount.mockResolvedValue({ id: 'acct_1' });
        mocks.setActiveOrganizationForMember.mockResolvedValue({
            id: 'acct_1',
            active_organization_id: 'org_2',
        });
    });

    it('requires authentication', async () => {
        mocks.getUser.mockResolvedValue(null);

        const response = await POST(request({ organizationId: 'org_2' }));

        expect(response.status).toBe(401);
        expect(mocks.setActiveOrganizationForMember).not.toHaveBeenCalled();
    });

    it('rejects missing organization IDs', async () => {
        const response = await POST(request({}));

        expect(response.status).toBe(400);
        expect(mocks.setActiveOrganizationForMember).not.toHaveBeenCalled();
    });

    it('switches only through the membership-guarded query', async () => {
        const response = await POST(request({ organizationId: 'org_2' }));

        expect(response.status).toBe(200);
        expect(mocks.setActiveOrganizationForMember).toHaveBeenCalledWith('acct_1', 'org_2');
        expect(await response.json()).toEqual({ success: true, organizationId: 'org_2' });
    });

    it('does not reveal or activate an organization without membership', async () => {
        mocks.setActiveOrganizationForMember.mockResolvedValue(null);

        const response = await POST(request({ organizationId: 'org_other' }));

        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ error: 'Workspace not found' });
    });
});
