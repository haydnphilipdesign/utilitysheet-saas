import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getUserMock: vi.fn(),
    checkRateLimitMock: vi.fn(),
    getRateLimitHeadersMock: vi.fn(),
    getOrCreateAccountMock: vi.fn(),
    ensureAccountRecordMock: vi.fn(),
    ensureAccountActivationMock: vi.fn(),
    getMonthlyUsageMock: vi.fn(),
    getRequestCountForAccountMock: vi.fn(),
    getDefaultBrandProfileMock: vi.fn(),
    getBrandProfileMock: vi.fn(),
    canAccessResourceMock: vi.fn(),
    createRequestMock: vi.fn(),
    updateRequestStatusMock: vi.fn(),
    createEventLogMock: vi.fn(),
    getOrganizationByIdMock: vi.fn(),
    buildStructuredPropertyAddressMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/stack/server', () => ({
    stackServerApp: {
        getUser: mocks.getUserMock,
    },
}));

vi.mock('@/lib/rate-limit', () => ({
    requestCreationRatelimit: {},
    checkRateLimit: mocks.checkRateLimitMock,
    getRateLimitHeaders: mocks.getRateLimitHeadersMock,
}));

vi.mock('@/lib/address/structured-address', () => ({
    buildStructuredPropertyAddress: mocks.buildStructuredPropertyAddressMock,
}));

vi.mock('@/lib/email/email-service', () => ({
    sendSellerNotificationEmail: vi.fn(),
}));

vi.mock('@/lib/neon/queries', () => ({
    getRequests: vi.fn(),
    createRequest: mocks.createRequestMock,
    getDashboardStats: vi.fn(),
    getOrCreateAccount: mocks.getOrCreateAccountMock,
    ensureAccountRecord: mocks.ensureAccountRecordMock,
    getMonthlyUsage: mocks.getMonthlyUsageMock,
    getBrandProfile: mocks.getBrandProfileMock,
    getDefaultBrandProfile: mocks.getDefaultBrandProfileMock,
    updateRequestStatus: mocks.updateRequestStatusMock,
    createEventLog: mocks.createEventLogMock,
    getRequestCountForAccount: mocks.getRequestCountForAccountMock,
    getOrganizationById: mocks.getOrganizationByIdMock,
}));

vi.mock('@/lib/auth/organization-access', () => ({
    canAccessOwnedOrActiveOrganizationResource: mocks.canAccessResourceMock,
}));

vi.mock('@/lib/activation/ensure-account-activation', () => ({
    ensureAccountActivation: mocks.ensureAccountActivationMock,
}));

import { POST } from '@/app/api/requests/route';

describe('POST /api/requests advanced gating', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUserMock.mockResolvedValue({
            id: 'user_1',
            primaryEmail: 'agent@example.com',
            displayName: 'Agent',
        });
        mocks.checkRateLimitMock.mockResolvedValue({ success: true });
        mocks.getRateLimitHeadersMock.mockReturnValue({});
        mocks.ensureAccountRecordMock.mockImplementation((user) => mocks.getOrCreateAccountMock(user));
        mocks.getOrCreateAccountMock.mockResolvedValue({
            id: 'acct_1',
            subscription_status: 'free',
            active_organization_id: null,
            full_name: 'Agent',
        });
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
        mocks.getMonthlyUsageMock.mockResolvedValue({ used: 0, limit: 3, plan: 'free' });
        mocks.getRequestCountForAccountMock.mockResolvedValue(0);
        mocks.getDefaultBrandProfileMock.mockResolvedValue(null);
        mocks.canAccessResourceMock.mockResolvedValue(true);
        mocks.getOrganizationByIdMock.mockResolvedValue(null);
        mocks.buildStructuredPropertyAddressMock.mockResolvedValue({
            street: '123 Main St',
            city: 'Austin',
            state: 'TX',
            zip: '78701',
            full: '123 Main St, Austin, TX 78701',
            confidence: 'high',
            issues: [],
            source: 'local',
        });
    });

    it('rejects client attempts to mark a normal request as a demo', async () => {
        const response = await POST(new Request('http://localhost/api/requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                propertyAddress: '123 Main St, Austin, TX 78701',
                isDemo: true,
            }),
        }));

        expect(response.status).toBe(400);
        expect(mocks.ensureAccountActivationMock).not.toHaveBeenCalled();
        expect(mocks.createRequestMock).not.toHaveBeenCalled();
    });

    it('rejects advanced packet creation for free users', async () => {
        const response = await POST(new Request('http://localhost/api/requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                propertyAddress: '123 Main St, Austin, TX 78701',
                packetMode: 'advanced',
                advancedModules: ['mailbox_access'],
                utilityCategories: ['electric', 'water'],
            }),
        }));

        expect(response.status).toBe(403);
        const body = await response.json();
        expect(String(body.message || '')).toMatch(/Property Handoff Packet mode/i);
        expect(mocks.createRequestMock).not.toHaveBeenCalled();
    });

    it('rejects a Branding Profile outside the authenticated account workspace', async () => {
        mocks.getBrandProfileMock.mockResolvedValue({
            id: '00000000-0000-4000-8000-000000000099',
            account_id: 'acct_other',
            organization_id: null,
        });
        mocks.canAccessResourceMock.mockResolvedValue(false);

        const response = await POST(new Request('http://localhost/api/requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                propertyAddress: '123 Main St, Austin, TX 78701',
                brandProfileId: '00000000-0000-4000-8000-000000000099',
            }),
        }));

        expect(response.status).toBe(400);
        expect(mocks.createRequestMock).not.toHaveBeenCalled();
    });
});
