import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ADVANCED_MODULE_DEFAULTS } from '@/lib/packet/modules';

const mocks = vi.hoisted(() => ({
    getUserMock: vi.fn(),
    getOrCreateAccountMock: vi.fn(),
    getAccountOrganizationsMock: vi.fn(),
    getOrCreateIntakeLinkMock: vi.fn(),
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
    getAccountOrganizations: mocks.getAccountOrganizationsMock,
    getOrCreateIntakeLink: mocks.getOrCreateIntakeLinkMock,
    updateIntakeLinkPacketDefaults: mocks.updateIntakeLinkPacketDefaultsMock,
    updateIntakeLinkSlug: mocks.updateIntakeLinkSlugMock,
    propagateAdvancedModuleDefaultsToOpenRequests: mocks.propagateAdvancedModuleDefaultsToOpenRequestsMock,
}));

import { GET, POST } from '@/app/api/intake-link/route';

describe('/api/intake-link', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUserMock.mockResolvedValue({ id: 'user_1', primaryEmail: 'agent@example.com', displayName: 'Agent' });
        mocks.getAccountOrganizationsMock.mockResolvedValue([]);
        mocks.getOrCreateIntakeLinkMock.mockResolvedValue({
            id: 'link_1',
            account_id: 'acct_1',
            slug: 'agent-link',
            is_active: true,
            default_packet_mode: 'simple',
            advanced_modules: [],
            advanced_module_exclusions: {},
        });
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
