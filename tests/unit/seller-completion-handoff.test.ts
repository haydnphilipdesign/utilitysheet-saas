// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    requestByToken: vi.fn(), account: vi.fn(), organization: vi.fn(), admins: vi.fn(), entries: vi.fn(),
    sql: vi.fn(), event: vi.fn(), submit: vi.fn(), completionEmail: vi.fn(), rateLimit: vi.fn(),
    recordEvent: vi.fn(), recordSuccess: vi.fn(), recordHandoff: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/ops/events', () => ({
    recordOperationalEvent: mocks.recordEvent,
    recordOperationalSuccess: mocks.recordSuccess,
    errorNameOf: () => 'Error',
}));
vi.mock('@/lib/neon/queries/handoff-evidence', () => ({ recordHandoffEvidence: mocks.recordHandoff }));
vi.mock('@/lib/neon/queries', () => ({
    getRequestBySellerToken: mocks.requestByToken,
    getRequestByToken: vi.fn(async () => null),
    getAccountById: mocks.account,
    getDefaultBrandProfile: vi.fn(async () => null),
    getBrandProfile: vi.fn(async () => null),
    getOrganizationById: mocks.organization,
    getOrganizationAdminRecipients: mocks.admins,
    getOrganizationMemberRole: vi.fn(async () => 'member'),
    getReferralIdentityForm: vi.fn(async () => null),
    getUtilityEntriesByRequestId: mocks.entries,
    createEventLog: mocks.event,
}));
vi.mock('@/lib/neon/queries/seller-submission', () => ({ submitSellerRequest: mocks.submit }));
vi.mock('@/lib/neon/db', () => ({ sql: mocks.sql }));
vi.mock('@/lib/rate-limit', () => ({
    formSubmissionRatelimit: {}, checkRateLimit: mocks.rateLimit,
    getRateLimitHeaders: vi.fn(() => ({})), isRateLimitUnavailable: vi.fn(() => false),
}));
vi.mock('@/lib/providers/contact-service', () => ({ hasValidContact: vi.fn(() => false), resolveContact: vi.fn(async () => null) }));
vi.mock('@/lib/email/email-service', () => ({
    sendTCCompletionNotificationEmail: mocks.completionEmail,
    sendContactResolutionAlertEmail: vi.fn(async () => ({ success: true })),
}));
vi.mock('@/lib/neon/queries/ai-lineage', () => ({ recordAcceptedChoices: vi.fn(async () => undefined), recordContactSkips: vi.fn(async () => undefined) }));
vi.mock('@/lib/referrals/award-referral-credit', () => ({ scheduleReferralCreditAward: vi.fn() }));

import { POST as sellerPost } from '@/app/api/seller/[token]/route';

const REQUEST_ID = '00000000-0000-4000-8000-0000000000d1';
const ADDRESS = '12 Original Road, Easton, PA 18040';
const stored = {
    id: REQUEST_ID, account_id: 'owner-account', organization_id: 'org-1', seller_token: 'seller-fixture',
    public_token: 'public-fixture', property_address: ADDRESS, seller_name: 'Sam Seller', status: 'in_progress',
    utility_categories: ['electric'], packet_mode: 'simple', metered_at: null, is_locked: false, seller_edit_version: 0,
};
const answers = {
    water_source: 'city', sewer_type: 'not_sure', heating_type: 'not_sure', primary_heating_type: null,
    fuels_present: [], trash_handled_by: 'not_sure',
    utilities: { electric: { entry_mode: 'free_text', display_name: 'PPL Electric', hidden: false } },
    edit_version: 0, submission_key: 'retry-key-0001',
};
const submit = () => sellerPost(new Request('http://localhost/api/seller/seller-fixture', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(answers),
}), { params: Promise.resolve({ token: 'seller-fixture' }) });

const pdfEvidence = {
    requestId: REQUEST_ID, isDemo: false, packetMode: 'simple', renderStrategy: 'print_pdf', launchStrategy: 'default',
    outcome: 'rendered', skipReason: null, failureStage: null, errorName: null,
    totalMs: 4000, dataMs: 40, launchMs: 800, renderMs: 3000, bytes: 40960,
};
const evidence = () => mocks.recordHandoff.mock.calls[0][0];

beforeEach(() => {
    vi.clearAllMocks();
    for (const level of ['log', 'warn', 'error'] as const) vi.spyOn(console, level).mockImplementation(() => undefined);
    mocks.sql.mockResolvedValue([]);
    mocks.event.mockResolvedValue(undefined);
    mocks.entries.mockResolvedValue([]);
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.requestByToken.mockResolvedValue(stored);
    mocks.submit.mockResolvedValue({ outcome: 'ACCEPTED', request: { id: REQUEST_ID }, currentEditVersion: 0 });
    mocks.account.mockResolvedValue({ email: 'owner@example.test', full_name: 'Owner', subscription_status: 'pro', notification_preferences: {} });
    mocks.organization.mockResolvedValue({ id: 'org-1', subscription_status: 'team', notification_settings: { notify_admins_on_submission: true } });
    mocks.admins.mockResolvedValue([
        { email: 'admin-one@example.test', full_name: 'Admin One', notification_preferences: { seller_submission_pdf_attachment: false } },
        { email: 'admin-two@example.test', full_name: 'Admin Two', notification_preferences: {} },
    ]);
    mocks.recordEvent.mockResolvedValue(true);
    mocks.recordSuccess.mockResolvedValue(true);
    mocks.recordHandoff.mockResolvedValue(true);
});

describe('completion email handoff evidence', () => {
    it('records each recipient slot of a partial send separately, in the order attempted', async () => {
        mocks.completionEmail
            .mockResolvedValueOnce({ success: true, messageId: 'msg_owner', attachmentStatus: 'attached', pdfEvidence })
            .mockResolvedValueOnce({ success: false, error: 'Invalid `to` field: admin-one@example.test', errorCode: 'validation_error', attachmentStatus: 'disabled', pdfEvidence: null })
            .mockRejectedValueOnce(new Error('socket hang up'));

        // The seller's submission succeeds whatever happens to the emails.
        expect((await submit()).status).toBe(200);
        expect(mocks.completionEmail).toHaveBeenCalledTimes(3);
        expect(mocks.recordHandoff).toHaveBeenCalledTimes(1);

        const { notifications, pdfRenders } = evidence();
        expect(notifications).toEqual([
            expect.objectContaining({ recipientSlot: 0, intendedRecipients: 3, sendOutcome: 'accepted', providerMessageId: 'msg_owner', attachmentStatus: 'attached' }),
            expect.objectContaining({ recipientSlot: 1, intendedRecipients: 3, sendOutcome: 'failed', failureCode: 'validation_error', attachmentStatus: 'disabled' }),
            expect.objectContaining({ recipientSlot: 2, intendedRecipients: 3, sendOutcome: 'unknown', failureCode: 'threw', attachmentStatus: 'not_applicable' }),
        ]);
        expect(new Set(notifications.map((row: { operationId: string }) => row.operationId)).size).toBe(1);
        expect(notifications.every((row: Record<string, unknown>) => row.requestId === REQUEST_ID && row.purpose === 'completion_notification' && row.mode === 'live')).toBe(true);
        expect(pdfRenders).toEqual([expect.objectContaining({ surface: 'completion_attachment', recipientSlot: 0, operationId: notifications[0].operationId, outcome: 'rendered' })]);

        // The existing incident still counts both unconfirmed sends.
        expect(mocks.recordEvent).toHaveBeenCalledWith(expect.objectContaining({
            category: 'email', code: 'completion_send_failed', requestId: REQUEST_ID, metadata: { recipientCount: 3, failedCount: 2 },
        }));
        // Slots, never addresses, names or message text.
        expect(JSON.stringify(mocks.recordHandoff.mock.calls)).not.toMatch(/example\.test|Owner|Admin One|Sam Seller|Original Road|Invalid|socket|seller-fixture/);
    });

    it('records an accepted email whose attachment failed without calling it a send failure', async () => {
        mocks.admins.mockResolvedValue([]);
        mocks.completionEmail.mockResolvedValue({
            success: true, messageId: 'msg_owner', attachmentStatus: 'failed',
            pdfEvidence: { ...pdfEvidence, outcome: 'failed', failureStage: 'browser_launch', errorName: 'Error', bytes: null },
        });
        expect((await submit()).status).toBe(200);
        expect(evidence().notifications).toEqual([expect.objectContaining({ sendOutcome: 'accepted', attachmentStatus: 'failed', intendedRecipients: 1 })]);
        expect(evidence().pdfRenders).toEqual([expect.objectContaining({ outcome: 'failed', failureStage: 'browser_launch' })]);
        expect(mocks.recordEvent).not.toHaveBeenCalled();
        expect(mocks.recordSuccess).toHaveBeenCalledWith({ category: 'email', code: 'completion_send_failed' });
    });

    it('makes a submission with nobody eligible visible instead of silent', async () => {
        mocks.admins.mockResolvedValue([]);
        mocks.account.mockResolvedValue({ email: 'owner@example.test', full_name: 'Owner', subscription_status: 'pro', notification_preferences: { seller_submissions: false } });
        expect((await submit()).status).toBe(200);
        expect(mocks.completionEmail).not.toHaveBeenCalled();
        expect(evidence()).toEqual({
            notifications: [expect.objectContaining({ requestId: REQUEST_ID, sendOutcome: 'no_recipients', intendedRecipients: 0, recipientSlot: 0 })],
            pdfRenders: [],
        });
        // Nobody opted in is not an incident.
        expect(mocks.recordEvent).not.toHaveBeenCalled();
    });

    it('still accepts the submission when the evidence store is unavailable', async () => {
        mocks.completionEmail.mockResolvedValue({ success: true, messageId: 'msg', attachmentStatus: 'attached', pdfEvidence });
        mocks.recordHandoff.mockResolvedValue(false);
        mocks.recordSuccess.mockResolvedValue(false);
        const response = await submit();
        expect(response.status).toBe(200);
        expect(mocks.completionEmail).toHaveBeenCalledTimes(3);
    });

    it('marks a seller test run as test so it stays out of live counts', async () => {
        mocks.requestByToken.mockResolvedValue({ ...stored, organization_id: null, is_demo: true });
        mocks.submit.mockResolvedValue({ outcome: 'ACCEPTED', request: { id: REQUEST_ID, is_demo: true }, currentEditVersion: 0 });
        mocks.organization.mockResolvedValue(null);
        mocks.completionEmail.mockResolvedValue({ success: true, messageId: 'msg_test', attachmentStatus: 'attached', pdfEvidence: { ...pdfEvidence, isDemo: true } });
        expect((await submit()).status).toBe(200);
        expect(evidence().notifications).toEqual([expect.objectContaining({ mode: 'test', sendOutcome: 'accepted' })]);
        expect(evidence().pdfRenders).toEqual([expect.objectContaining({ mode: 'test' })]);
    });
});
