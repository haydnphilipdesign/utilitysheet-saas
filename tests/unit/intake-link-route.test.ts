import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ADVANCED_MODULE_DEFAULTS } from '@/lib/packet/modules';

const mocks = vi.hoisted(() => ({
    getUserMock: vi.fn(),
    getOrCreateAccountMock: vi.fn(),
    ensureAccountRecordMock: vi.fn(),
    ensureAccountActivationMock: vi.fn(),
    getAccountOrganizationsMock: vi.fn(),
    getBrandProfilesMock: vi.fn(),
    getOrCreateIntakeLinkMock: vi.fn(),
    normalizeIntakeUtilityCategoriesMock: vi.fn((value: unknown) => (
        Array.isArray(value) && value.length > 0
            ? value
            : ['electric', 'gas', 'propane', 'oil', 'water', 'sewer', 'trash', 'internet', 'cable']
    )),
    updateIntakeLinkSellerFormDefaultsMock: vi.fn(),
    updateIntakeLinkPacketDefaultsMock: vi.fn(),
    updateIntakeLinkSlugMock: vi.fn(),
    propagateAdvancedModuleDefaultsToOpenRequestsMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/stack/server', () => ({
    stackServerApp: {
        getUser: mocks.getUserMock,
    },
}));

vi.mock('@/lib/neon/queries', () => ({
    getOrCreateAccount: mocks.getOrCreateAccountMock,
    ensureAccountRecord: mocks.ensureAccountRecordMock,
    getAccountOrganizations: mocks.getAccountOrganizationsMock,
    getBrandProfiles: mocks.getBrandProfilesMock,
    getOrCreateIntakeLink: mocks.getOrCreateIntakeLinkMock,
    normalizeIntakeUtilityCategories: mocks.normalizeIntakeUtilityCategoriesMock,
    updateIntakeLinkSellerFormDefaults: mocks.updateIntakeLinkSellerFormDefaultsMock,
    updateIntakeLinkPacketDefaults: mocks.updateIntakeLinkPacketDefaultsMock,
    updateIntakeLinkSlug: mocks.updateIntakeLinkSlugMock,
    propagateAdvancedModuleDefaultsToOpenRequests: mocks.propagateAdvancedModuleDefaultsToOpenRequestsMock,
}));

vi.mock('@/lib/activation/ensure-account-activation', () => ({
    ensureAccountActivation: mocks.ensureAccountActivationMock,
}));

import { GET, POST } from '@/app/api/intake-link/route';

describe('/api/intake-link', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUserMock.mockResolvedValue({ id: 'user_1', primaryEmail: 'agent@example.com', displayName: 'Agent' });
        mocks.ensureAccountRecordMock.mockImplementation((user) => mocks.getOrCreateAccountMock(user));
        mocks.ensureAccountActivationMock.mockImplementation(async () => ({
            account: await mocks.getOrCreateAccountMock(),
            organizations: [],
            activeOrganization: null,
            defaultBrandProfile: null,
            activation: {
                accountCreated: false,
                organizationCreated: false,
                organizationAssigned: false,
                brandProfileCreated: false,
                intakeLinkCreated: false,
                defaultsProvisioned: false,
            },
        }));
        mocks.getAccountOrganizationsMock.mockResolvedValue([]);
        mocks.getBrandProfilesMock.mockResolvedValue([
            { id: '00000000-0000-4000-8000-000000000001', name: 'ACME Realty', is_default: true },
            { id: '00000000-0000-4000-8000-000000000002', name: 'Agent Brand', is_default: false },
        ]);
        mocks.getOrCreateIntakeLinkMock.mockResolvedValue({
            id: 'link_1',
            account_id: 'acct_1',
            slug: 'agent-link',
            is_active: true,
            default_packet_mode: 'simple',
            advanced_modules: [],
            advanced_module_exclusions: {},
        });
        mocks.updateIntakeLinkSellerFormDefaultsMock.mockImplementation(async (_accountId, defaults) => ({
            id: 'link_1',
            account_id: 'acct_1',
            slug: 'agent-link',
            is_active: defaults.isActive,
            default_brand_profile_id: defaults.defaultBrandProfileId,
            default_utility_categories: defaults.defaultUtilityCategories,
            default_packet_mode: 'simple',
            advanced_modules: [],
            advanced_module_exclusions: {},
        }));
    });

    it('returns normalized advanced module defaults on GET when stored list is empty', async () => {
        mocks.getOrCreateAccountMock.mockResolvedValue({
            id: 'acct_1',
            subscription_status: 'pro',
            active_organization_id: null,
            company_name: 'ACME Realty',
        });
        mocks.getOrCreateIntakeLinkMock.mockResolvedValue({
            id: 'link_1',
            account_id: 'acct_1',
            slug: 'agent-link',
            is_active: true,
            default_packet_mode: 'advanced',
            advanced_modules: [],
            advanced_module_exclusions: {},
        });

        const response = await GET();
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.intakeLink.defaultPacketMode).toBe('advanced');
        expect(body.intakeLink.advancedModules).toEqual(ADVANCED_MODULE_DEFAULTS);
        expect(body.intakeLink.defaultBrandProfileId).toBeNull();
        expect(body.intakeLink.defaultUtilityCategories).toEqual([
            'electric',
            'gas',
            'propane',
            'oil',
            'water',
            'sewer',
            'trash',
            'internet',
            'cable',
        ]);
        expect(body.brandProfiles).toEqual([
            { id: '00000000-0000-4000-8000-000000000001', name: 'ACME Realty', isDefault: true },
            { id: '00000000-0000-4000-8000-000000000002', name: 'Agent Brand', isDefault: false },
        ]);
    });

    it('allows free users to pause the seller form and save scoped form defaults', async () => {
        mocks.getOrCreateAccountMock.mockResolvedValue({
            id: 'acct_1',
            subscription_status: 'free',
            active_organization_id: null,
        });

        const response = await POST(new Request('http://localhost/api/intake-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                isActive: false,
                defaultBrandProfileId: '00000000-0000-4000-8000-000000000002',
                defaultUtilityCategories: ['electric', 'water', 'internet'],
            }),
        }));

        expect(response.status).toBe(200);
        expect(mocks.updateIntakeLinkSellerFormDefaultsMock).toHaveBeenCalledWith('acct_1', {
            isActive: false,
            defaultBrandProfileId: '00000000-0000-4000-8000-000000000002',
            defaultUtilityCategories: ['electric', 'water', 'internet'],
        });
        expect(mocks.updateIntakeLinkPacketDefaultsMock).not.toHaveBeenCalled();
        const body = await response.json();
        expect(body.intakeLink).toEqual(expect.objectContaining({
            is_active: false,
            defaultBrandProfileId: '00000000-0000-4000-8000-000000000002',
            defaultUtilityCategories: ['electric', 'water', 'internet'],
        }));
    });

    it('rejects a Branding Profile outside the active account scope', async () => {
        mocks.getOrCreateAccountMock.mockResolvedValue({
            id: 'acct_1',
            subscription_status: 'pro',
            active_organization_id: null,
        });

        const response = await POST(new Request('http://localhost/api/intake-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ defaultBrandProfileId: '00000000-0000-4000-8000-000000000099' }),
        }));

        expect(response.status).toBe(400);
        expect(mocks.updateIntakeLinkSellerFormDefaultsMock).not.toHaveBeenCalled();
    });

    it('rejects an empty utility-category default', async () => {
        mocks.getOrCreateAccountMock.mockResolvedValue({
            id: 'acct_1',
            subscription_status: 'pro',
            active_organization_id: null,
        });

        const response = await POST(new Request('http://localhost/api/intake-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ defaultUtilityCategories: [] }),
        }));

        expect(response.status).toBe(400);
        expect(mocks.updateIntakeLinkSellerFormDefaultsMock).not.toHaveBeenCalled();
    });

    it('saves mode and module defaults together for paid users', async () => {
        mocks.getOrCreateAccountMock.mockResolvedValue({
            id: 'acct_1',
            subscription_status: 'pro',
            active_organization_id: null,
        });
        mocks.updateIntakeLinkPacketDefaultsMock.mockResolvedValue({
            id: 'link_1',
            account_id: 'acct_1',
            slug: 'agent-link',
            is_active: true,
            default_packet_mode: 'advanced',
            advanced_modules: ['mailbox_access', 'service_providers'],
            advanced_module_exclusions: { service_providers: ['service_provider_notes'] },
        });

        const response = await POST(new Request('http://localhost/api/intake-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                defaultPacketMode: 'advanced',
                advancedModules: ['mailbox_access', 'service_providers'],
                advancedModuleExclusions: { service_providers: ['service_provider_notes'] },
            }),
        }));

        expect(response.status).toBe(200);
        expect(mocks.updateIntakeLinkPacketDefaultsMock).toHaveBeenCalledWith('acct_1', {
            defaultPacketMode: 'advanced',
            advancedModules: ['mailbox_access', 'service_providers'],
            advancedModuleExclusions: { service_providers: ['service_provider_notes'] },
        });
        expect(mocks.propagateAdvancedModuleDefaultsToOpenRequestsMock).toHaveBeenCalledWith(
            'acct_1',
            undefined,
            {
                advancedModules: ['mailbox_access', 'service_providers'],
                advancedModuleExclusions: { service_providers: ['service_provider_notes'] },
            }
        );
        const body = await response.json();
        expect(body.intakeLink.defaultPacketMode).toBe('advanced');
        expect(body.intakeLink.advancedModules).toEqual(['mailbox_access', 'service_providers']);
        expect(body.intakeLink.advancedModuleExclusions).toEqual({ service_providers: ['service_provider_notes'] });
    });

    it('blocks free users from changing advanced mode or modules', async () => {
        mocks.getOrCreateAccountMock.mockResolvedValue({
            id: 'acct_1',
            subscription_status: 'free',
            active_organization_id: null,
        });

        const response = await POST(new Request('http://localhost/api/intake-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                defaultPacketMode: 'advanced',
                advancedModules: ['mailbox_access'],
            }),
        }));

        expect(response.status).toBe(403);
        expect(mocks.updateIntakeLinkPacketDefaultsMock).not.toHaveBeenCalled();
    });

    it('allows slug-only updates without changing mode/module defaults', async () => {
        mocks.getOrCreateAccountMock.mockResolvedValue({
            id: 'acct_1',
            subscription_status: 'pro',
            active_organization_id: null,
        });
        mocks.getOrCreateIntakeLinkMock.mockResolvedValue({
            id: 'link_1',
            account_id: 'acct_1',
            slug: 'agent-link',
            is_active: true,
            default_packet_mode: 'advanced',
            advanced_modules: ['mailbox_access'],
            advanced_module_exclusions: { mailbox_access: ['parking_instructions'] },
        });
        mocks.updateIntakeLinkSlugMock.mockResolvedValue({
            id: 'link_1',
            account_id: 'acct_1',
            slug: 'new-agent-link',
            is_active: true,
            default_packet_mode: 'advanced',
            advanced_modules: ['mailbox_access'],
            advanced_module_exclusions: { mailbox_access: ['parking_instructions'] },
        });

        const response = await POST(new Request('http://localhost/api/intake-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: 'new-agent-link' }),
        }));

        expect(response.status).toBe(200);
        expect(mocks.updateIntakeLinkSlugMock).toHaveBeenCalledWith('acct_1', 'new-agent-link');
        expect(mocks.updateIntakeLinkPacketDefaultsMock).not.toHaveBeenCalled();
        const body = await response.json();
        expect(body.intakeLink.defaultPacketMode).toBe('advanced');
        expect(body.intakeLink.advancedModules).toEqual(['mailbox_access']);
        expect(body.intakeLink.advancedModuleExclusions).toEqual({ mailbox_access: ['parking_instructions'] });
    });
});
