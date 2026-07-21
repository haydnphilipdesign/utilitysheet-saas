import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getRole: vi.fn(),
    getOrganization: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/neon/queries/organizations', () => ({
    getOrganizationMemberRole: mocks.getRole,
    getOrganizationById: mocks.getOrganization,
}));

import {
    canAccessOwnedOrActiveOrganizationResource,
    getAuthorizedActiveOrganization,
} from '@/lib/auth/organization-access';

describe('organization resource authorization', () => {
    beforeEach(() => vi.clearAllMocks());

    it('allows a personal owner without consulting workspace membership', async () => {
        await expect(canAccessOwnedOrActiveOrganizationResource(
            { id: 'acct_1', active_organization_id: 'org_1' },
            { account_id: 'acct_1', organization_id: null },
        )).resolves.toBe(true);
        expect(mocks.getRole).not.toHaveBeenCalled();
    });

    it('requires live membership even when the account points at the same active organization', async () => {
        mocks.getRole.mockResolvedValue(null);
        await expect(canAccessOwnedOrActiveOrganizationResource(
            { id: 'acct_1', active_organization_id: 'org_1' },
            { account_id: 'acct_other', organization_id: 'org_1' },
        )).resolves.toBe(false);
        expect(mocks.getRole).toHaveBeenCalledWith('org_1', 'acct_1');
    });

    it('does not let a former creator bypass membership on an organization-scoped record', async () => {
        mocks.getRole.mockResolvedValue(null);
        await expect(canAccessOwnedOrActiveOrganizationResource(
            { id: 'acct_1', active_organization_id: 'org_1' },
            { account_id: 'acct_1', organization_id: 'org_1' },
        )).resolves.toBe(false);
    });

    it('returns a paid workspace only after live membership is confirmed', async () => {
        mocks.getRole.mockResolvedValue('member');
        mocks.getOrganization.mockResolvedValue({ id: 'org_1', subscription_status: 'team' });

        await expect(getAuthorizedActiveOrganization({ id: 'acct_1', active_organization_id: 'org_1' }))
            .resolves.toEqual({ id: 'org_1', subscription_status: 'team', role: 'member' });
    });
});
