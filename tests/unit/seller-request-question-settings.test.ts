import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
    request: vi.fn(), account: vi.fn(), sql: vi.fn(), event: vi.fn(), submit: vi.fn(),
}));
// Operational observations are best-effort and covered in ops-instrumentation.test.ts.
vi.mock('@/lib/ops/events');
vi.mock('server-only', () => ({}));
vi.mock('@/lib/neon/queries', () => ({
    getRequestBySellerToken: mocks.request,
    getRequestByToken: vi.fn(),
    getAccountById: mocks.account,
    getDefaultBrandProfile: vi.fn(async () => null),
    getBrandProfile: vi.fn(async () => null),
    getOrganizationById: vi.fn(async () => null),
    getOrganizationAdminRecipients: vi.fn(async () => []),
    getReferralIdentityForm: vi.fn(async () => null),
    getMonthlyUsage: vi.fn(async () => ({ used: 0, limit: 3 })),
    createEventLog: mocks.event,
}));
vi.mock('@/lib/neon/db', () => ({ sql: mocks.sql }));
vi.mock('@/lib/neon/queries/seller-submission', () => ({ submitSellerRequest: mocks.submit }));
vi.mock('@/lib/rate-limit', () => ({
    formSubmissionRatelimit: {}, checkRateLimit: vi.fn(async () => ({ success: true })),
    getRateLimitHeaders: vi.fn(() => ({})), isRateLimitUnavailable: vi.fn(() => false),
}));
vi.mock('@/lib/providers/contact-service', () => ({ hasValidContact: vi.fn(() => true), resolveContact: vi.fn() }));
vi.mock('@/lib/email/email-service', () => ({ sendTCCompletionNotificationEmail: vi.fn(), sendContactResolutionAlertEmail: vi.fn() }));
vi.mock('@/lib/neon/queries/ai-telemetry', () => ({ markAiSuggestionSelection: vi.fn() }));
vi.mock('@/lib/referrals/award-referral-credit', () => ({ scheduleReferralCreditAward: vi.fn() }));
import { GET, POST } from '@/app/api/seller/[token]/route';

const context = { params: Promise.resolve({ token: 'seller-fixture' }) };
const storedRequest = {
    id: 'fixture-request', account_id: 'fixture-account', seller_token: 'seller-fixture',
    public_token: 'public-fixture', property_address: '123 Test Lane', status: 'in_progress',
    utility_categories: ['electric'], packet_mode: 'simple',
};

describe('seller API request question overrides', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.sql.mockResolvedValue([]);
        mocks.event.mockResolvedValue(undefined);
        mocks.submit.mockResolvedValue({ outcome: 'ACCEPTED', request: {}, currentEditVersion: 0 });
    });

    it.each([true, false, null])('uses %s consistently in GET and POST against opposite account defaults', async (value) => {
        const accountDefault = value !== true;
        mocks.request.mockResolvedValue({ ...storedRequest, collect_hoa_questions: value, collect_electric_meter_number: value });
        mocks.account.mockResolvedValue({ subscription_status: 'pro', notification_preferences: { collect_hoa_questions: accountDefault, collect_electric_meter_number: accountDefault } });
        const effective = value ?? accountDefault;
        const response = await GET(new Request('http://localhost/api/seller/seller-fixture'), context);
        expect(response.status).toBe(200);
        expect((await response.json()).request).toMatchObject({ collect_hoa_questions: effective, collect_electric_meter_number: effective });
        mocks.sql.mockClear();
        const submitted = await POST(new Request('http://localhost/api/seller/seller-fixture', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                water_source: 'not_sure', sewer_type: 'not_sure', heating_type: 'not_sure', primary_heating_type: null,
                fuels_present: [], trash_handled_by: 'not_sure',
                has_hoa: 'yes', hoa_name: 'Example HOA',
                utilities: { electric: { entry_mode: 'unknown', meter_number: 'METER-FIXTURE' } },
            }),
        }), context);
        expect(submitted.status).toBe(200);
        const stored = mocks.submit.mock.calls[0][0];
        expect(stored.updateHoa).toBe(effective);
        expect(stored.entries[0].meter_number).toBe(effective ? 'METER-FIXTURE' : null);
    });
});
