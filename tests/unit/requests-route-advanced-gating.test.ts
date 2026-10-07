import { beforeEach, describe, expect, it, vi } from 'vitest';
import { savedForm } from '../fixtures/saved-seller-forms';

const mocks = vi.hoisted(() => ({
    getSellerFormMock: vi.fn(),
    getIntakeBrandProfileMock: vi.fn(),
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
    getUsableSellerForm: mocks.getSellerFormMock,
    getIntakeBrandProfile: mocks.getIntakeBrandProfileMock,
    getRequests: vi.fn(),
    workspaceHasOtherRequestOwners: vi.fn(),
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
        mocks.createRequestMock.mockResolvedValue({ id: 'new-request', seller_token: 'synthetic-token' });
        mocks.getSellerFormMock.mockResolvedValue({ ...savedForm, account_id: 'acct_1' });
        mocks.getIntakeBrandProfileMock.mockResolvedValue(null);
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

    it('snapshots an authorized selected form and preserves explicit request-only overrides', async () => {
        const res = await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ propertyAddress: '123 Main St, Austin, TX 78701', formId: savedForm.id, formRevision: 2, collectHoaQuestions: true }) }));
        expect(res.status).toBe(201);
        expect(mocks.getSellerFormMock).toHaveBeenCalledWith(savedForm.id, 'acct_1', undefined);
        expect(mocks.createRequestMock).toHaveBeenCalledWith(expect.objectContaining({ sourceFormId: savedForm.id, sourceFormRevision: 2, sellerIntro: savedForm.seller_intro, collectHoaQuestions: true, collectElectricMeterNumber: false, utilityCategories: ['electric', 'water'] }));
    });
    it('rejects stale or foreign form selection before creating anything', async () => {
        const create = (revision: number) => POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ propertyAddress: '123 Main St, Austin, TX 78701', formId: savedForm.id, formRevision: revision }) }));
        expect((await create(1)).status).toBe(409); expect(mocks.createRequestMock).not.toHaveBeenCalled();
        mocks.getSellerFormMock.mockResolvedValue(null); expect((await create(2)).status).toBe(404); expect(mocks.createRequestMock).not.toHaveBeenCalled();
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

    it('creates a Free request even when monthly usage is at the limit', async () => {
        mocks.getMonthlyUsageMock.mockResolvedValue({ used: 3, limit: 3, plan: 'free' });
        mocks.createRequestMock.mockResolvedValue({
            id: 'req_1',
            public_token: 'public-token',
            seller_token: 'seller-token',
        });
        mocks.updateRequestStatusMock.mockResolvedValue({ id: 'req_1', status: 'sent' });

        const response = await POST(new Request('http://localhost/api/requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                propertyAddress: '123 Main St, Austin, TX 78701',
                utilityCategories: ['electric', 'water'],
                sendSellerEmail: false,
            }),
        }));

        expect(response.status).toBe(201);
        expect(mocks.createRequestMock).toHaveBeenCalledTimes(1);
        expect(mocks.getMonthlyUsageMock).not.toHaveBeenCalled();
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

    it.each([true, false])('persists %s question choices on a Free individual request', async (value) => {
        mocks.createRequestMock.mockResolvedValue({ id: 'req_1', seller_token: 'seller-token' });
        const response = await POST(new Request('http://localhost/api/requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ propertyAddress: '123 Test Lane', collectHoaQuestions: value, collectElectricMeterNumber: !value, sendSellerEmail: false }),
        }));
        expect(response.status).toBe(201);
        expect(mocks.createRequestMock).toHaveBeenCalledWith(expect.objectContaining({
            collectHoaQuestions: value, collectElectricMeterNumber: !value,
        }));
    });
});
