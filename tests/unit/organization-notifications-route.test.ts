import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getUserMock: vi.fn(),
    getOrCreateAccountMock: vi.fn(),
    getOrganizationByIdMock: vi.fn(),
    getOrganizationMemberRoleMock: vi.fn(),
    updateOrganizationNotificationSettingsMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/stack/server', () => ({
    stackServerApp: { getUser: mocks.getUserMock },
}));

vi.mock('@/lib/neon/queries', () => ({
    getOrCreateAccount: mocks.getOrCreateAccountMock,
    getOrganizationById: mocks.getOrganizationByIdMock,
    getOrganizationMemberRole: mocks.getOrganizationMemberRoleMock,
    updateOrganizationNotificationSettings: mocks.updateOrganizationNotificationSettingsMock,
}));

import { PATCH } from '@/app/api/organization/notifications/route';

function patch(body: unknown) {
    return PATCH(new Request('http://localhost/api/organization/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }));
}

describe('PATCH /api/organization/notifications', () => {
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
        mocks.getOrganizationByIdMock.mockResolvedValue({
            id: 'org_active',
            notification_settings: {},
        });
        mocks.getOrganizationMemberRoleMock.mockResolvedValue('admin');
        mocks.updateOrganizationNotificationSettingsMock.mockResolvedValue({
            id: 'org_active',
            notification_settings: { notify_admins_on_submission: true },
        });
    });

    it('rejects unauthenticated requests', async () => {
        mocks.getUserMock.mockResolvedValue(null);
        const response = await patch({ notify_admins_on_submission: true });
        expect(response.status).toBe(401);
        expect(mocks.updateOrganizationNotificationSettingsMock).not.toHaveBeenCalled();
    });

    it('rejects ordinary members', async () => {
        mocks.getOrganizationMemberRoleMock.mockResolvedValue('member');
        const response = await patch({ notify_admins_on_submission: true });
        expect(response.status).toBe(403);
        expect(mocks.updateOrganizationNotificationSettingsMock).not.toHaveBeenCalled();
    });

    it('rejects invalid or client-supplied payloads', async () => {
        const response = await patch({ notify_admins_on_submission: 'yes', organizationId: 'org_attacker' });
        expect(response.status).toBe(400);
        expect(mocks.updateOrganizationNotificationSettingsMock).not.toHaveBeenCalled();
    });

    it('updates only the authenticated account active organization', async () => {
        const response = await patch({ notify_admins_on_submission: true });

        expect(response.status).toBe(200);
        expect(mocks.getOrganizationMemberRoleMock).toHaveBeenCalledWith('org_active', 'acct_admin');
        expect(mocks.updateOrganizationNotificationSettingsMock).toHaveBeenCalledWith('org_active', {
            notify_admins_on_submission: true,
        });
        expect(await response.json()).toEqual({
            notification_settings: { notify_admins_on_submission: true },
        });
    });

    it('returns 404 when the account has no active organization', async () => {
        mocks.getOrCreateAccountMock.mockResolvedValue({ id: 'acct_admin', active_organization_id: null });
        const response = await patch({ notify_admins_on_submission: true });
        expect(response.status).toBe(404);
        expect(mocks.updateOrganizationNotificationSettingsMock).not.toHaveBeenCalled();
    });
});
