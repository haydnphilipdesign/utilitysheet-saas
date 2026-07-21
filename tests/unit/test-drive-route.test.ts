import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(),
    ensureAccountActivation: vi.fn(),
    checkRateLimit: vi.fn(),
    getTestDriveRequestState: vi.fn(),
    getOrCreateTestDriveRequest: vi.fn(),
    getTestDriveLifecycleEvents: vi.fn(),
    getIntakeLinkByAccountId: vi.fn(),
    getIntakeBrandProfile: vi.fn(),
    getBrandProfile: vi.fn(),
    createEventLog: vi.fn(),
    sendSellerNotificationEmail: vi.fn(),
    buildStructuredPropertyAddress: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/stack/server', () => ({ stackServerApp: { getUser: mocks.getUser } }));
vi.mock('@/lib/activation/ensure-account-activation', () => ({
    ensureAccountActivation: mocks.ensureAccountActivation,
}));
vi.mock('@/lib/rate-limit', () => ({
    requestCreationRatelimit: {},
    checkRateLimit: mocks.checkRateLimit,
    getRateLimitHeaders: () => ({ 'x-ratelimit-remaining': '9' }),
    isRateLimitUnavailable: (result: { unavailable?: boolean }) => Boolean(result?.unavailable),
}));
vi.mock('@/lib/address/structured-address', () => ({
    buildStructuredPropertyAddress: mocks.buildStructuredPropertyAddress,
}));
vi.mock('@/lib/email/email-service', () => ({
    sendSellerNotificationEmail: mocks.sendSellerNotificationEmail,
}));
vi.mock('@/lib/neon/queries', () => ({
    getTestDriveRequestState: mocks.getTestDriveRequestState,
    getOrCreateTestDriveRequest: mocks.getOrCreateTestDriveRequest,
    getTestDriveLifecycleEvents: mocks.getTestDriveLifecycleEvents,
    getIntakeLinkByAccountId: mocks.getIntakeLinkByAccountId,
    getIntakeBrandProfile: mocks.getIntakeBrandProfile,
    getBrandProfile: mocks.getBrandProfile,
    createEventLog: mocks.createEventLog,
}));

import { GET, POST } from '@/app/api/test-drive/route';

const demoRequest = {
    id: 'req_demo',
    account_id: 'acct_1',
    organization_id: 'org_1',
    brand_profile_id: 'brand_1',
    property_address: '[TEST] 123 Maple Street, Anytown, PA 18301',
    property_address_structured: null,
    seller_name: 'UtilitySheet Test Seller',
    seller_email: 'verified@example.com',
    seller_phone: null,
    closing_date: null,
    status: 'sent',
    public_token: 'public_token',
    seller_token: 'seller_token',
    is_demo: true,
    created_at: '2026-07-21T10:00:00.000Z',
    updated_at: '2026-07-21T10:00:00.000Z',
    last_activity_at: '2026-07-21T10:00:00.000Z',
};

function post(body: unknown = {}) {
    return POST(new Request('http://localhost/api/test-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }));
}

describe('/api/test-drive', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUser.mockResolvedValue({
            id: 'auth_1',
            primaryEmail: 'verified@example.com',
            displayName: 'Test TC',
        });
        mocks.ensureAccountActivation.mockResolvedValue({
            account: {
                id: 'acct_1',
                email: 'verified@example.com',
                full_name: 'Test TC',
                subscription_status: 'free',
                active_organization_id: 'org_1',
            },
            activeOrganization: { id: 'org_1', subscription_status: 'free' },
            defaultBrandProfile: { id: 'brand_1', contact_name: 'Test TC' },
        });
        mocks.checkRateLimit.mockResolvedValue({ success: true });
        mocks.getTestDriveRequestState.mockResolvedValue({ request: null, hasLiveSubmission: false });
        mocks.getOrCreateTestDriveRequest.mockResolvedValue({
            request: demoRequest,
            created: true,
            hasLiveSubmission: false,
        });
        mocks.getTestDriveLifecycleEvents.mockResolvedValue([
            { event_type: 'test_drive_invitation_succeeded', event_data: null, created_at: '2026-07-21T10:00:00.000Z' },
        ]);
        mocks.getIntakeLinkByAccountId.mockResolvedValue({
            default_brand_profile_id: 'brand_1',
            default_utility_categories: ['electric', 'water'],
            default_packet_mode: 'simple',
            advanced_modules: [],
            advanced_module_exclusions: {},
        });
        mocks.getIntakeBrandProfile.mockResolvedValue({ id: 'brand_1', contact_name: 'Test TC' });
        mocks.getBrandProfile.mockResolvedValue({ id: 'brand_1', contact_name: 'Test TC' });
        mocks.buildStructuredPropertyAddress.mockResolvedValue(null);
        mocks.sendSellerNotificationEmail.mockResolvedValue({ success: true });
    });

    it('rejects unauthenticated status and creation', async () => {
        mocks.getUser.mockResolvedValue(null);
        expect((await GET()).status).toBe(401);
        expect((await post()).status).toBe(401);
        expect(mocks.getOrCreateTestDriveRequest).not.toHaveBeenCalled();
    });

    it('requires the authenticated verified email', async () => {
        mocks.getUser.mockResolvedValue({ id: 'auth_1', primaryEmail: null });
        expect((await GET()).status).toBe(400);
        expect((await post({ recipient: 'attacker@example.com' })).status).toBe(400);
        expect(mocks.sendSellerNotificationEmail).not.toHaveBeenCalled();
    });

    it('reports eligible, resumable, completed, and live-submission states from account-scoped server data', async () => {
        expect(await (await GET()).json()).toEqual({ status: 'eligible' });

        mocks.getTestDriveRequestState.mockResolvedValue({ request: demoRequest, hasLiveSubmission: false });
        expect(await (await GET()).json()).toEqual({
            status: 'ready',
            sellerUrl: '/s/seller_token',
            invitationDelivery: 'sent',
        });

        mocks.getTestDriveRequestState.mockResolvedValue({
            request: { ...demoRequest, status: 'submitted' },
            hasLiveSubmission: false,
        });
        mocks.getTestDriveLifecycleEvents.mockResolvedValue([
            { event_type: 'test_drive_delivery_failed', event_data: null, created_at: '2026-07-21T10:00:00.000Z' },
        ]);
        expect(await (await GET()).json()).toEqual({
            status: 'completed',
            reviewUrl: '/packet/public_token',
            pdfUrl: '/api/packet/public_token/pdf',
            delivery: 'failed',
        });

        mocks.getTestDriveRequestState.mockResolvedValue({ request: demoRequest, hasLiveSubmission: true });
        expect(await (await GET()).json()).toEqual({ status: 'ineligible', reason: 'live_submission' });
        expect(mocks.getTestDriveRequestState).toHaveBeenCalledWith('acct_1');
    });

    it('derives fictional identity and recipient from the authenticated account, never the body', async () => {
        const response = await post({
            recipient: 'victim@example.com',
            sellerEmail: 'victim@example.com',
            propertyAddress: 'A real private address',
        });

        expect(response.status).toBe(201);
        expect(mocks.getOrCreateTestDriveRequest).toHaveBeenCalledWith(expect.objectContaining({
            accountId: 'acct_1',
            organizationId: 'org_1',
            sellerEmail: 'verified@example.com',
            sellerName: 'UtilitySheet Test Seller',
            propertyAddress: '[TEST] 123 Maple Street, Anytown, PA 18301',
            brandProfileId: 'brand_1',
            utilityCategories: ['electric', 'water'],
        }));
        expect(mocks.sendSellerNotificationEmail).toHaveBeenCalledWith(expect.objectContaining({
            sellerEmail: 'verified@example.com',
            sellerName: 'UtilitySheet Test Seller',
            sellerToken: 'seller_token',
        }));
        expect(JSON.stringify(mocks.sendSellerNotificationEmail.mock.calls)).not.toContain('victim@example.com');
    });

    it('resumes without sending another invitation', async () => {
        mocks.getOrCreateTestDriveRequest.mockResolvedValue({
            request: demoRequest,
            created: false,
            hasLiveSubmission: false,
        });

        const response = await post();
        expect(response.status).toBe(200);
        expect(mocks.sendSellerNotificationEmail).not.toHaveBeenCalled();
        expect(mocks.createEventLog).not.toHaveBeenCalled();
    });

    it('keeps the direct resume link available when invitation delivery fails', async () => {
        mocks.sendSellerNotificationEmail.mockResolvedValue({ success: false, error: 'provider down' });
        mocks.getTestDriveLifecycleEvents.mockResolvedValue([
            { event_type: 'test_drive_invitation_failed', event_data: null, created_at: '2026-07-21T10:00:00.000Z' },
        ]);

        const response = await post();
        expect(response.status).toBe(201);
        expect(await response.json()).toEqual({
            status: 'ready',
            sellerUrl: '/s/seller_token',
            invitationDelivery: 'failed',
        });
        expect(mocks.createEventLog).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'test_drive_invitation_failed',
        }));
    });

    it('does not let telemetry failure prevent invitation delivery or resume access', async () => {
        mocks.createEventLog.mockRejectedValue(new Error('telemetry unavailable'));

        const response = await post();

        expect(response.status).toBe(201);
        expect(mocks.sendSellerNotificationEmail).toHaveBeenCalledTimes(1);
        expect(await response.json()).toEqual({
            status: 'ready',
            sellerUrl: '/s/seller_token',
            invitationDelivery: 'sent',
        });
    });

    it('returns ineligible without sending when a real submission exists', async () => {
        mocks.getOrCreateTestDriveRequest.mockResolvedValue({
            request: null,
            created: false,
            hasLiveSubmission: true,
        });

        const response = await post();
        expect(await response.json()).toEqual({ status: 'ineligible', reason: 'live_submission' });
        expect(mocks.sendSellerNotificationEmail).not.toHaveBeenCalled();
    });
});
