import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getUserMock: vi.fn(),
    checkRateLimitMock: vi.fn(),
    getRateLimitHeadersMock: vi.fn(),
    getOrCreateAccountMock: vi.fn(),
    getMonthlyUsageMock: vi.fn(),
    getRequestCountForAccountMock: vi.fn(),
    getDefaultBrandProfileMock: vi.fn(),
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
    getMonthlyUsage: mocks.getMonthlyUsageMock,
    getBrandProfile: vi.fn(),
    getDefaultBrandProfile: mocks.getDefaultBrandProfileMock,
    updateRequestStatus: mocks.updateRequestStatusMock,
    createEventLog: mocks.createEventLogMock,
    getRequestCountForAccount: mocks.getRequestCountForAccountMock,
    getOrganizationById: mocks.getOrganizationByIdMock,
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
        mocks.getOrCreateAccountMock.mockResolvedValue({
            id: 'acct_1',
            subscription_status: 'free',
            active_organization_id: null,
            full_name: 'Agent',
        });
        mocks.getMonthlyUsageMock.mockResolvedValue({ used: 0, limit: 3, plan: 'free' });
        mocks.getRequestCountForAccountMock.mockResolvedValue(0);
        mocks.getDefaultBrandProfileMock.mockResolvedValue(null);
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
        expect(String(body.message || '')).toMatch(/Advanced Utility Packets/i);
        expect(mocks.createRequestMock).not.toHaveBeenCalled();
    });
});
