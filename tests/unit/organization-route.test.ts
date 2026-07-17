import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getUserMock: vi.fn(),
    getOrCreateAccountMock: vi.fn(),
    getOrganizationMemberRoleMock: vi.fn(),
    updateOrganizationMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/stack/server', () => ({
    stackServerApp: { getUser: mocks.getUserMock },
}));

vi.mock('@/lib/neon/queries', () => ({
    getOrCreateAccount: mocks.getOrCreateAccountMock,
    getOrganizationMemberRole: mocks.getOrganizationMemberRoleMock,
    updateOrganization: mocks.updateOrganizationMock,
}));

import { PATCH } from '@/app/api/organization/route';

describe('PATCH /api/organization', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUserMock.mockResolvedValue({
            id: 'user_admin',
            primaryEmail: 'admin@example.com',
            displayName: 'Admin User',
        });
        mocks.getOrCreateAccountMock.mockResolvedValue({
            id: 'acct_admin',
            active_organization_id: 'org_active',
        });
        mocks.getOrganizationMemberRoleMock.mockResolvedValue('admin');
        mocks.updateOrganizationMock.mockResolvedValue({
            id: 'org_active',
            name: 'Renamed Workspace',
            slug: 'renamed-workspace',
        });
    });

    it('rejects ordinary members', async () => {
        mocks.getOrganizationMemberRoleMock.mockResolvedValue('member');

        const response = await PATCH(new Request('http://localhost/api/organization', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Renamed Workspace' }),
        }));

        expect(response.status).toBe(403);
        expect(mocks.updateOrganizationMock).not.toHaveBeenCalled();
    });

    it('validates the workspace name', async () => {
        const response = await PATCH(new Request('http://localhost/api/organization', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'x' }),
        }));

        expect(response.status).toBe(400);
        expect(mocks.updateOrganizationMock).not.toHaveBeenCalled();
    });

    it('rejects client-supplied organization or role authority', async () => {
        const response = await PATCH(new Request('http://localhost/api/organization', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Renamed Workspace',
                organizationId: 'org_attacker_selected',
                role: 'admin',
            }),
        }));

        expect(response.status).toBe(400);
        expect(mocks.updateOrganizationMock).not.toHaveBeenCalled();
    });

    it('renames only the authenticated account active organization', async () => {
        const response = await PATCH(new Request('http://localhost/api/organization', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: '  Renamed Workspace  ' }),
        }));

        expect(response.status).toBe(200);
        expect(mocks.getOrganizationMemberRoleMock).toHaveBeenCalledWith('org_active', 'acct_admin');
        expect(mocks.updateOrganizationMock).toHaveBeenCalledWith('org_active', 'Renamed Workspace');
        expect(await response.json()).toEqual({
            organization: {
                id: 'org_active',
                name: 'Renamed Workspace',
                slug: 'renamed-workspace',
            },
        });
    });
});
