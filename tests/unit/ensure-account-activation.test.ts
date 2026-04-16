import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMocks = vi.hoisted(() => ({
    createBrandProfile: vi.fn(),
    createOrganization: vi.fn(),
    ensureAccountRecord: vi.fn(),
    ensureIntakeLink: vi.fn(),
    getAccountById: vi.fn(),
    getAccountOrganizations: vi.fn(),
    getBrandProfiles: vi.fn(),
    getDefaultBrandProfile: vi.fn(),
    setActiveOrganization: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/neon/queries', () => queryMocks);

import { ensureAccountActivation } from '@/lib/activation/ensure-account-activation';

describe('ensureAccountActivation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('provisions an account, organization, brand profile, and intake link for a new user', async () => {
        queryMocks.ensureAccountRecord.mockResolvedValue({
            account: {
                id: 'acc_1',
                email: 'jane@example.com',
                full_name: 'Jane Smith',
                phone: null,
                active_organization_id: null,
            },
            created: true,
        });
        queryMocks.getAccountOrganizations
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: 'org_1', name: 'Jane Smith', role: 'admin' }]);
        queryMocks.getBrandProfiles.mockResolvedValue([]);
        queryMocks.createOrganization.mockResolvedValue({ id: 'org_1', name: 'Jane Smith', role: 'admin' });
        queryMocks.getAccountById.mockResolvedValue({
            id: 'acc_1',
            email: 'jane@example.com',
            full_name: 'Jane Smith',
            phone: null,
            active_organization_id: 'org_1',
        });
        queryMocks.getDefaultBrandProfile.mockResolvedValue(null);
        queryMocks.createBrandProfile.mockResolvedValue({
            id: 'brand_1',
            organization_id: 'org_1',
            is_default: true,
        });
        queryMocks.ensureIntakeLink.mockResolvedValue({
            intakeLink: { id: 'link_1', slug: 'abc123' },
            created: true,
        });

        const result = await ensureAccountActivation({
            id: 'auth_1',
            primaryEmail: 'jane@example.com',
            displayName: 'Jane Smith',
            signedUpAt: new Date('2026-01-08T14:21:48.952Z'),
        });

        expect(queryMocks.ensureAccountRecord).toHaveBeenCalledWith(
            'auth_1',
            'jane@example.com',
            'Jane Smith',
            new Date('2026-01-08T14:21:48.952Z')
        );
        expect(queryMocks.createOrganization).toHaveBeenCalledWith('Jane Smith', 'acc_1');
        expect(queryMocks.createBrandProfile).toHaveBeenCalledWith(expect.objectContaining({
            accountId: 'acc_1',
            organizationId: 'org_1',
            name: 'Jane Smith',
        }));
        expect(queryMocks.ensureIntakeLink).toHaveBeenCalledWith('acc_1');
        expect(result?.activation).toEqual(expect.objectContaining({
            accountCreated: true,
            organizationCreated: true,
            brandProfileCreated: true,
            intakeLinkCreated: true,
            defaultsProvisioned: true,
        }));
    });

    it('preserves legacy account-scoped branding instead of auto-creating a new organization', async () => {
        queryMocks.ensureAccountRecord.mockResolvedValue({
            account: {
                id: 'acc_legacy',
                email: 'legacy.agent@example.com',
                full_name: null,
                phone: null,
                active_organization_id: null,
            },
            created: false,
        });
        queryMocks.getAccountOrganizations.mockResolvedValue([]);
        queryMocks.getBrandProfiles.mockResolvedValue([{ id: 'brand_legacy', organization_id: null }]);
        queryMocks.getDefaultBrandProfile.mockResolvedValue({
            id: 'brand_legacy',
            organization_id: null,
            is_default: true,
        });
        queryMocks.ensureIntakeLink.mockResolvedValue({
            intakeLink: { id: 'link_legacy', slug: 'legacy123' },
            created: false,
        });

        const result = await ensureAccountActivation({
            id: 'auth_legacy',
            primaryEmail: 'legacy.agent@example.com',
            displayName: null,
            signedUpAt: new Date('2026-01-20T19:59:06.757Z'),
        });

        expect(queryMocks.ensureAccountRecord).toHaveBeenCalledWith(
            'auth_legacy',
            'legacy.agent@example.com',
            undefined,
            new Date('2026-01-20T19:59:06.757Z')
        );
        expect(queryMocks.createOrganization).not.toHaveBeenCalled();
        expect(queryMocks.createBrandProfile).not.toHaveBeenCalled();
        expect(result?.activeOrganization).toBeNull();
        expect(result?.activation.organizationCreated).toBe(false);
        expect(result?.activation.defaultsProvisioned).toBe(false);
    });
});
