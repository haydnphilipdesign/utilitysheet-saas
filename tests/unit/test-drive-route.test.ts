import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(),
    ensureAccountActivation: vi.fn(),
    checkRateLimit: vi.fn(),
    getTestDriveRequestState: vi.fn(),
    getOrCreateTestDriveRequest: vi.fn(),
    getTestDriveLifecycleEvents: vi.fn(),
    getOrCreateIntakeLink: vi.fn(),
    getIntakeBrandProfile: vi.fn(),
    getBrandProfile: vi.fn(),
    createEventLog: vi.fn(),
    sendSellerNotificationEmail: vi.fn(),
    buildStructuredPropertyAddress: vi.fn(),
    recordHandoff: vi.fn(),
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
vi.mock('@/lib/neon/queries/handoff-evidence', () => ({ recordHandoffEvidence: mocks.recordHandoff }));
vi.mock('@/lib/neon/queries', () => ({
    getTestDriveRequestState: mocks.getTestDriveRequestState,
    getOrCreateTestDriveRequest: mocks.getOrCreateTestDriveRequest,
    getTestDriveLifecycleEvents: mocks.getTestDriveLifecycleEvents,
    getOrCreateIntakeLink: mocks.getOrCreateIntakeLink,
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
        mocks.getTestDriveRequestState.mockResolvedValue({ request: null, hasLiveSubmission: false, testCount: 0 });
        mocks.getOrCreateTestDriveRequest.mockResolvedValue({
            request: demoRequest,
            created: true,
            hasLiveSubmission: false,
            testCount: 1,
        });
        mocks.getTestDriveLifecycleEvents.mockResolvedValue([
            { event_type: 'test_drive_invitation_succeeded', event_data: null, created_at: '2026-07-21T10:00:00.000Z' },
        ]);
        mocks.getOrCreateIntakeLink.mockResolvedValue({
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
        mocks.recordHandoff.mockResolvedValue(true);
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

        mocks.getTestDriveRequestState.mockResolvedValue({ request: demoRequest, hasLiveSubmission: false, testCount: 1 });
        expect(await (await GET()).json()).toEqual({
            status: 'ready',
            sellerUrl: '/s/seller_token',
            invitationDelivery: 'sent',
            canStartAnother: true,
        });

        mocks.getTestDriveRequestState.mockResolvedValue({
            request: { ...demoRequest, status: 'submitted' },
            hasLiveSubmission: false,
            testCount: 3,
        });
        mocks.getTestDriveLifecycleEvents.mockResolvedValue([
            { event_type: 'test_drive_delivery_failed', event_data: null, created_at: '2026-07-21T10:00:00.000Z' },
        ]);
        expect(await (await GET()).json()).toEqual({
            status: 'completed',
            reviewUrl: '/packet/public_token',
            pdfUrl: '/api/packet/public_token/pdf',
            delivery: 'failed',
            canStartAnother: false,
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
            startAnother: false,
            limit: 3,
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
            canStartAnother: true,
        });
        expect(mocks.createEventLog).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'test_drive_invitation_failed',
        }), { signal: expect.any(AbortSignal) });
    });

    it('records the test invitation as test-mode evidence, and a returned refusal as failed', async () => {
        const requestId = '00000000-0000-4000-8000-0000000000d2';
        mocks.getOrCreateTestDriveRequest.mockResolvedValue({ request: { ...demoRequest, id: requestId }, created: true, hasLiveSubmission: false });
        mocks.sendSellerNotificationEmail.mockResolvedValueOnce({ success: true, messageId: 'msg_test_invite' });
        expect((await post()).status).toBe(201);
        mocks.sendSellerNotificationEmail.mockResolvedValueOnce({ success: false, error: 'provider down', errorCode: 'application_error' });
        expect((await post()).status).toBe(201);

        expect(mocks.recordHandoff.mock.calls.map((call) => call[0].notifications[0])).toEqual([
            expect.objectContaining({ requestId, purpose: 'request_invitation', mode: 'test', sendOutcome: 'accepted', providerMessageId: 'msg_test_invite' }),
            expect.objectContaining({ requestId, purpose: 'request_invitation', mode: 'test', sendOutcome: 'failed', failureCode: 'application_error' }),
        ]);
        expect(JSON.stringify(mocks.recordHandoff.mock.calls)).not.toMatch(/verified@example\.com|seller_token|provider down/);
    });

    it('still starts the test when handoff evidence cannot be stored', async () => {
        mocks.recordHandoff.mockResolvedValue(false);
        expect((await post()).status).toBe(201);
        expect(mocks.sendSellerNotificationEmail).toHaveBeenCalledTimes(1);
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
            canStartAnother: true,
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

    describe('in the user’s own area', () => {
        it('starts a new test at a made-up street in that area', async () => {
            const areaRequest = { ...demoRequest, property_address: '[TEST] 123 Maple Street, Austin, TX 78704' };
            mocks.getOrCreateTestDriveRequest.mockResolvedValue({
                request: areaRequest,
                created: true,
                hasLiveSubmission: false,
                testCount: 2,
            });

            const response = await post({ area: '  Austin,  TX 78704 ' });

            expect(response.status).toBe(201);
            expect(mocks.buildStructuredPropertyAddress).toHaveBeenCalledWith('[TEST] 123 Maple Street, Austin, TX 78704');
            expect(mocks.getOrCreateTestDriveRequest).toHaveBeenCalledWith(expect.objectContaining({
                propertyAddress: '[TEST] 123 Maple Street, Austin, TX 78704',
                startAnother: true,
                limit: 3,
            }));
            expect(mocks.sendSellerNotificationEmail).toHaveBeenCalledWith(expect.objectContaining({
                propertyAddress: '[TEST] 123 Maple Street, Austin, TX 78704',
            }));
            expect(mocks.createEventLog).toHaveBeenCalledWith(expect.objectContaining({
                eventType: 'request_created',
                eventData: expect.objectContaining({ test_area: 'custom', is_demo: true }),
            }), { signal: expect.any(AbortSignal) });
            expect(JSON.stringify(mocks.createEventLog.mock.calls)).not.toContain('Austin');
        });

        it('treats a blank area as the sample address', async () => {
            expect((await post({ area: '   ' })).status).toBe(201);
            expect(mocks.getOrCreateTestDriveRequest).toHaveBeenCalledWith(expect.objectContaining({
                propertyAddress: '[TEST] 123 Maple Street, Anytown, PA 18301',
                startAnother: false,
            }));
        });

        it.each([
            ['a street address', '456 Oak Ave, Austin, TX 78704', 'not a street address'],
            ['a ZIP alone', '78704', 'city and state'],
            ['markup', '<b>Austin</b>, TX', 'city and state'],
        ])('rejects %s before creating anything', async (_label, area, message) => {
            const response = await post({ area });

            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.code).toBe('invalid_area');
            expect(body.error).toContain(message);
            expect(mocks.getOrCreateTestDriveRequest).not.toHaveBeenCalled();
            expect(mocks.sendSellerNotificationEmail).not.toHaveBeenCalled();
        });

        it('rejects a malformed body', async () => {
            expect((await post({ area: 12 })).status).toBe(400);
            const response = await POST(new Request('http://localhost/api/test-drive', { method: 'POST', body: '{nope' }));
            expect(response.status).toBe(400);
            expect(mocks.getOrCreateTestDriveRequest).not.toHaveBeenCalled();
        });

        it('says so when every test is used, without sending anything', async () => {
            mocks.getOrCreateTestDriveRequest.mockResolvedValue({
                request: { ...demoRequest, status: 'submitted' },
                created: false,
                hasLiveSubmission: false,
                testCount: 3,
            });

            const response = await post({ area: 'Austin, TX' });

            expect(response.status).toBe(409);
            expect(await response.json()).toEqual({ error: 'You have used all 3 seller tests.', code: 'test_limit' });
            expect(mocks.sendSellerNotificationEmail).not.toHaveBeenCalled();
            expect(mocks.createEventLog).not.toHaveBeenCalled();
        });

        it('still refuses a test once a real seller has submitted', async () => {
            mocks.getOrCreateTestDriveRequest.mockResolvedValue({
                request: null,
                created: false,
                hasLiveSubmission: true,
                testCount: 1,
            });

            const response = await post({ area: 'Austin, TX' });
            expect(await response.json()).toEqual({ status: 'ineligible', reason: 'live_submission' });
            expect(mocks.sendSellerNotificationEmail).not.toHaveBeenCalled();
        });
    });
});
