import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    requestByToken: vi.fn(), requestById: vi.fn(), account: vi.fn(), organization: vi.fn(), usage: vi.fn(), entries: vi.fn(),
    sql: vi.fn(), event: vi.fn(), submit: vi.fn(), reopen: vi.fn(), cancel: vi.fn(), updateStatus: vi.fn(),
    completionEmail: vi.fn(), alertEmail: vi.fn(), reminderEmail: vi.fn(), referral: vi.fn(), suggestion: vi.fn(),
    getUser: vi.fn(), getOrCreateAccount: vi.fn(), canAccess: vi.fn(), rateLimit: vi.fn(),
}));

vi.mock('@/lib/ops/events');
vi.mock('server-only', () => ({}));
vi.mock('@/lib/neon/queries', () => ({
    getRequestBySellerToken: mocks.requestByToken,
    getRequestByToken: vi.fn(async () => null),
    getRequestById: mocks.requestById,
    getAccountById: mocks.account,
    getOrCreateAccount: mocks.getOrCreateAccount,
    getDefaultBrandProfile: vi.fn(async () => null),
    getBrandProfile: vi.fn(async () => null),
    getOrganizationById: mocks.organization,
    getOrganizationAdminRecipients: vi.fn(async () => []),
    getOrganizationMemberRole: vi.fn(async () => 'member'),
    getReferralIdentityForm: vi.fn(async () => null),
    getMonthlyUsage: mocks.usage,
    getUtilityEntriesByRequestId: mocks.entries,
    createEventLog: mocks.event,
    updateRequestStatus: mocks.updateStatus,
    deleteRequest: vi.fn(),
}));
vi.mock('@/lib/neon/queries/seller-submission', () => ({
    submitSellerRequest: mocks.submit,
    reopenSubmittedRequest: mocks.reopen,
    cancelRequestReopen: mocks.cancel,
}));
vi.mock('@/lib/neon/db', () => ({ sql: mocks.sql }));
vi.mock('@/lib/rate-limit', () => ({
    formSubmissionRatelimit: {}, reminderRatelimit: {}, checkRateLimit: mocks.rateLimit,
    getRateLimitHeaders: vi.fn(() => ({})), isRateLimitUnavailable: vi.fn((result: { unavailable?: boolean }) => Boolean(result?.unavailable)),
}));
vi.mock('@/lib/providers/contact-service', () => ({ hasValidContact: vi.fn(() => false), resolveContact: vi.fn(async () => null) }));
vi.mock('@/lib/email/email-service', () => ({
    sendTCCompletionNotificationEmail: mocks.completionEmail,
    sendContactResolutionAlertEmail: mocks.alertEmail,
    sendSellerReminderEmail: mocks.reminderEmail,
}));
vi.mock('@/lib/neon/queries/ai-telemetry', () => ({ markAiSuggestionSelection: mocks.suggestion }));
vi.mock('@/lib/referrals/award-referral-credit', () => ({ scheduleReferralCreditAward: mocks.referral }));
vi.mock('@/lib/stack/server', () => ({ stackServerApp: { getUser: mocks.getUser } }));
vi.mock('@/lib/auth/organization-access', () => ({
    canAccessOwnedOrActiveOrganizationResource: mocks.canAccess,
    getAuthorizedActiveOrganization: vi.fn(async () => null),
}));

import { GET as sellerGet, POST as sellerPost } from '@/app/api/seller/[token]/route';
import { POST as sendLink } from '@/app/api/seller/[token]/send-link/route';
import { DELETE as closeReopen, POST as reopen } from '@/app/api/requests/[id]/reopen/route';
import { PATCH as patchRequest } from '@/app/api/requests/[id]/route';

const ADDRESS = '12 Original Road, Easton, PA 18040';
const stored = {
    id: 'request-1', account_id: 'owner-account', organization_id: null, seller_token: 'seller-fixture',
    public_token: 'public-fixture', property_address: ADDRESS, status: 'in_progress',
    utility_categories: ['electric', 'water'], packet_mode: 'simple', metered_at: null, is_locked: false,
    seller_edit_version: 0,
};
const sellerContext = { params: Promise.resolve({ token: 'seller-fixture' }) };
const requestContext = { params: Promise.resolve({ id: 'request-1' }) };

const answers = {
    water_source: 'city', sewer_type: 'not_sure', heating_type: 'not_sure', primary_heating_type: null,
    fuels_present: [], trash_handled_by: 'not_sure',
    utilities: {
        electric: { entry_mode: 'suggested_confirmed', display_name: 'PPL Electric', hidden: false },
        water: { entry_mode: 'free_text', display_name: 'City Water', contact_phone: '555-0199', hidden: false },
    },
};

const submit = (body: Record<string, unknown>) => sellerPost(new Request('http://localhost/api/seller/seller-fixture', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}), sellerContext);

function expectNoSideEffects() {
    expect(mocks.completionEmail).not.toHaveBeenCalled();
    expect(mocks.alertEmail).not.toHaveBeenCalled();
    expect(mocks.referral).not.toHaveBeenCalled();
    expect(mocks.suggestion).not.toHaveBeenCalled();
    expect(mocks.sql).not.toHaveBeenCalled();
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.sql.mockResolvedValue([]);
    mocks.event.mockResolvedValue(undefined);
    mocks.requestByToken.mockResolvedValue(stored);
    mocks.requestById.mockResolvedValue({ ...stored, status: 'submitted' });
    mocks.account.mockResolvedValue({ email: 'owner@example.test', full_name: 'Owner', subscription_status: 'free', notification_preferences: {} });
    mocks.organization.mockResolvedValue(null);
    mocks.usage.mockResolvedValue({ plan: 'free', used: 3, limit: 3 });
    mocks.entries.mockResolvedValue([]);
    mocks.submit.mockResolvedValue({ outcome: 'ACCEPTED', request: { id: 'request-1' }, currentEditVersion: 0 });
    mocks.completionEmail.mockResolvedValue({ success: true });
    mocks.suggestion.mockResolvedValue(undefined);
    mocks.getUser.mockResolvedValue({ id: 'auth-1', primaryEmail: 'owner@example.test', displayName: 'Owner' });
    mocks.getOrCreateAccount.mockResolvedValue({ id: 'owner-account', subscription_status: 'free' });
    mocks.canAccess.mockResolvedValue(true);
    mocks.rateLimit.mockResolvedValue({ success: true });
});

describe('seller submission route', () => {
    it('stores once, then runs side effects only for the accepted submission', async () => {
        const response = await submit({ ...answers, edit_version: 0, submission_key: 'retry-key-0001' });

        expect(response.status).toBe(200);
        expect(mocks.submit).toHaveBeenCalledTimes(1);
        expect(mocks.submit.mock.calls[0][0]).toMatchObject({
            requestId: 'request-1', editVersion: 0, submissionKey: 'retry-key-0001',
            waterSource: 'city', isTestDrive: false,
        });
        expect(mocks.submit.mock.calls[0][0].entries.map((row: { category: string }) => row.category)).toEqual(['electric', 'water']);
        expect(mocks.completionEmail).toHaveBeenCalledTimes(1);
        expect(mocks.referral).toHaveBeenCalledWith('owner-account');
        expect(mocks.suggestion).toHaveBeenCalledTimes(1);
    });

    it('ignores crafted fields: address, ownership, metering, lock and status cannot be supplied', async () => {
        await submit({
            ...answers,
            property_address: '99 Different Street', propertyAddress: '99 Different Street',
            account_id: 'attacker-account', organization_id: 'attacker-org', requestId: 'another-request',
            metered_at: null, is_locked: false, shouldLock: false, isTestDrive: true, status: 'draft',
            seller_edit_version: 0, utility_categories: ['internet'],
            utilities: { ...answers.utilities, internet: { entry_mode: 'free_text', display_name: 'Not Requested', hidden: false } },
        });

        const input = mocks.submit.mock.calls[0][0];
        expect(Object.keys(input).sort()).toEqual([
            'advancedPacketData', 'editVersion', 'entries', 'eventData', 'heatingType', 'hoa', 'ipAddress',
            'isTestDrive', 'requestId', 'sewerType', 'submissionKey', 'updateHoa', 'userAgent', 'waterSource',
        ]);
        expect(input).toMatchObject({ requestId: 'request-1', isTestDrive: false });
        expect(JSON.stringify(input)).not.toMatch(/Different Street|attacker|another-request|Not Requested/);
        // The owner is notified about the stored property, not a supplied one.
        expect(mocks.completionEmail.mock.calls[0][0]).toMatchObject({ propertyAddress: ADDRESS, requestId: 'request-1' });
    });

    it.each([
        ['ALREADY_SUBMITTED', 409, 'ALREADY_SUBMITTED'],
        ['STALE_SESSION', 409, 'STALE_SESSION'],
        ['NOT_FOUND', 404, undefined],
    ])('refuses %s without emails, credits or follow-up writes', async (outcome, status, code) => {
        mocks.submit.mockResolvedValueOnce({ outcome, request: null, currentEditVersion: 1 });
        const response = await submit({ ...answers, edit_version: 0, submission_key: 'retry-key-0001' });

        expect(response.status).toBe(status);
        expect((await response.json()).code).toBe(code);
        expectNoSideEffects();
    });

    it('answers a retry of a stored submission as success without repeating side effects', async () => {
        mocks.submit.mockResolvedValueOnce({ outcome: 'DUPLICATE', request: null, currentEditVersion: 0 });
        const response = await submit({ ...answers, edit_version: 0, submission_key: 'retry-key-0001' });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ success: true, alreadySubmitted: true });
        expectNoSideEffects();
    });

    it('reports a persistence failure and sends nothing', async () => {
        mocks.submit.mockRejectedValueOnce(new Error('connection reset'));
        const response = await submit({ ...answers, edit_version: 0, submission_key: 'retry-key-0001' });

        expect(response.status).toBe(500);
        expectNoSideEffects();
    });

    it('treats a tab without a session number as the first session and rejects a malformed key', async () => {
        await submit(answers);
        expect(mocks.submit.mock.calls[0][0]).toMatchObject({ editVersion: 0, submissionKey: null });

        mocks.submit.mockClear();
        expect((await submit({ ...answers, submission_key: 'x' })).status).toBe(400);
        expect((await submit({ ...answers, edit_version: -1 })).status).toBe(400);
        expect(mocks.submit).not.toHaveBeenCalled();
    });

    it('leaves the Free limit to the stored submission: no usage read and no lock input', async () => {
        await submit(answers);

        expect(mocks.usage).not.toHaveBeenCalled();
        expect(mocks.submit.mock.calls[0][0]).not.toHaveProperty('shouldLock');
        expect(mocks.completionEmail.mock.calls[0][0].propertyAddress).toBe(ADDRESS);
    });

    it('hides a submission that was stored locked and skips contact lookups for it', async () => {
        mocks.submit.mockResolvedValueOnce({ outcome: 'ACCEPTED', request: { id: 'request-1', is_locked: true }, currentEditVersion: 0 });
        await submit(answers);

        expect(mocks.completionEmail.mock.calls[0][0]).toMatchObject({ propertyAddress: 'Locked — upgrade to view', sellerName: undefined });
        expect(mocks.alertEmail).not.toHaveBeenCalled();
        expect(mocks.sql).not.toHaveBeenCalled();
    });

    it('goes by the stored row, not the row read before the write', async () => {
        // Read as locked, stored unlocked (cannot happen today; proves which one is used).
        mocks.requestByToken.mockResolvedValue({ ...stored, is_locked: true });
        await submit(answers);
        expect(mocks.completionEmail.mock.calls[0][0].propertyAddress).toBe(ADDRESS);
    });

    it.each([
        ['a Pro owner', { subscription_status: 'pro' }, null],
        ['a Team workspace', { subscription_status: 'free' }, { id: 'org-1', subscription_status: 'team' }],
    ])('shows a locked sheet to %s', async (_label, accountPlan, organization) => {
        mocks.account.mockResolvedValue({ email: 'owner@example.test', full_name: 'Owner', notification_preferences: {}, ...accountPlan });
        mocks.requestByToken.mockResolvedValue({ ...stored, organization_id: organization ? 'org-1' : null });
        mocks.organization.mockResolvedValue(organization);
        mocks.submit.mockResolvedValueOnce({ outcome: 'ACCEPTED', request: { id: 'request-1', is_locked: true }, currentEditVersion: 0 });
        await submit(answers);

        expect(mocks.completionEmail.mock.calls[0][0].propertyAddress).toBe(ADDRESS);
    });

    it('passes a resubmission through with its session and no usage read', async () => {
        mocks.requestByToken.mockResolvedValue({ ...stored, metered_at: '2026-09-01T12:00:00.000Z', seller_edit_version: 1 });
        await submit({ ...answers, edit_version: 1, submission_key: 'retry-key-0002' });

        expect(mocks.usage).not.toHaveBeenCalled();
        expect(mocks.submit.mock.calls[0][0]).toMatchObject({ editVersion: 1 });
        expect(mocks.completionEmail.mock.calls[0][0].propertyAddress).toBe(ADDRESS);
    });

    it('keeps a contact already on the sheet when a reopened request is resubmitted', async () => {
        mocks.requestByToken.mockResolvedValue({ ...stored, metered_at: '2026-09-01T12:00:00.000Z', seller_edit_version: 1 });
        await submit({ ...answers, edit_version: 1, utilities: { water: answers.utilities.water } });

        expect(mocks.submit.mock.calls[0][0].entries[0]).toMatchObject({ category: 'water', contact_phone: '555-0199' });
        // No historical lookup and no contact overwrite for that provider.
        expect(mocks.sql).not.toHaveBeenCalled();
    });
});

describe('seller form data', () => {
    const get = () => sellerGet(new Request('http://localhost/api/seller/seller-fixture'), sellerContext);

    it('returns only the address, branding and status once submitted', async () => {
        mocks.requestByToken.mockResolvedValue({
            ...stored, status: 'submitted', has_hoa: 'yes', hoa_name: 'Lakeview HOA',
            packet_mode: 'advanced', advanced_modules: ['mailbox_access'],
            advanced_packet_data: { mailbox_access: { garage_door_code: '0420' } },
        });
        const body = await (await get()).json();

        expect(body.request).toEqual({ property_address: ADDRESS, status: 'submitted', edit_version: 0, is_demo: false });
        expect(JSON.stringify(body)).not.toMatch(/Lakeview|0420/);
        expect(mocks.entries).not.toHaveBeenCalled();
    });

    it('returns the stored sheet for a reopened request', async () => {
        mocks.requestByToken.mockResolvedValue({
            ...stored, seller_edit_version: 2, water_source: 'city', sewer_type: 'septic', heating_type: 'oil',
            collect_electric_meter_number: false,
        });
        mocks.entries.mockResolvedValue([
            { category: 'electric', entry_mode: 'free_text', display_name: 'Corrected Power Co', raw_text: 'Corrected Power Co', meter_number: 'M-1', contact_phone: '555-0100', contact_url: null, extra: {} },
            { category: 'internet', entry_mode: 'free_text', display_name: 'Not Requested', raw_text: null, extra: {} },
        ]);
        const body = await (await get()).json();

        expect(body.request.edit_version).toBe(2);
        expect(body.request.prefill).toMatchObject({ water_source: 'city', sewer_type: 'septic', heating_type: 'oil' });
        expect(body.request.prefill.utilities).toEqual([
            expect.objectContaining({ category: 'electric', display_name: 'Corrected Power Co', contact_phone: '555-0100', meter_number: null }),
        ]);
    });

    it('sends no prefill in the first session', async () => {
        const body = await (await get()).json();
        expect(body.request.edit_version).toBe(0);
        expect(body.request.prefill).toBeUndefined();
        expect(mocks.entries).not.toHaveBeenCalled();
    });

    it('refuses to email a return link for a submitted request', async () => {
        mocks.requestByToken.mockResolvedValue({ ...stored, status: 'submitted' });
        const response = await sendLink(new Request('http://localhost/api/seller/seller-fixture/send-link', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'seller@example.test' }),
        }), sellerContext);

        expect(response.status).toBe(409);
        expect(mocks.reminderEmail).not.toHaveBeenCalled();
    });
});

describe('reopen route', () => {
    const call = (handler: typeof reopen, body?: unknown) => handler(new Request('http://localhost/api/requests/request-1/reopen', {
        method: handler === reopen ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json', 'user-agent': 'vitest' },
        body: body === undefined ? undefined : JSON.stringify(body),
    }), requestContext);

    beforeEach(() => {
        mocks.reopen.mockResolvedValue({ outcome: 'OK', request: { id: 'request-1', status: 'in_progress', seller_edit_version: 1 }, currentEditVersion: 1 });
        mocks.cancel.mockResolvedValue({ outcome: 'OK', request: { id: 'request-1', status: 'submitted', seller_edit_version: 2 }, currentEditVersion: 2 });
    });

    it('requires a signed-in coordinator with access to the request', async () => {
        mocks.getUser.mockResolvedValueOnce(null);
        expect((await call(reopen)).status).toBe(401);
        mocks.canAccess.mockResolvedValueOnce(false);
        expect((await call(reopen)).status).toBe(403);
        mocks.requestById.mockResolvedValueOnce(null);
        expect((await call(reopen)).status).toBe(404);
        mocks.rateLimit.mockResolvedValueOnce({ success: false });
        expect((await call(reopen)).status).toBe(429);
        expect(mocks.reopen).not.toHaveBeenCalled();
    });

    it('works on the Free plan, reads no request body, and sends no email', async () => {
        const response = await call(reopen, {
            property_address: '99 Different Street', account_id: 'attacker-account', organization_id: 'attacker-org',
            metered_at: null, is_locked: false, status: 'draft', requestId: 'another-request', sendEmail: true,
        });

        expect(response.status).toBe(200);
        expect(mocks.reopen).toHaveBeenCalledWith({
            requestId: 'request-1', actorAccountId: 'owner-account', ipAddress: null, userAgent: 'vitest',
        });
        expect(mocks.completionEmail).not.toHaveBeenCalled();
        expect(mocks.reminderEmail).not.toHaveBeenCalled();
        // Reopening never grants the paid editor.
        expect((await response.json()).can_edit_submitted_sheet).toBe(false);
    });

    it.each([
        ['LOCKED', 409], ['TEST_REQUEST', 409], ['NOT_SUBMITTED', 409], ['NOT_FOUND', 404],
    ])('reports %s without changing anything else', async (outcome, status) => {
        mocks.reopen.mockResolvedValueOnce({ outcome, request: null, currentEditVersion: 0 });
        const response = await call(reopen);
        expect(response.status).toBe(status);
        expect((await response.json()).code).toBe(outcome);
    });

    it('closes a reopened request through the separate statement', async () => {
        const response = await call(closeReopen);
        expect(response.status).toBe(200);
        expect(mocks.cancel).toHaveBeenCalledTimes(1);
        expect(mocks.reopen).not.toHaveBeenCalled();

        mocks.cancel.mockResolvedValueOnce({ outcome: 'NOT_REOPENED', request: null, currentEditVersion: 0 });
        expect((await call(closeReopen)).status).toBe(409);
    });
});

describe('generic request status update', () => {
    const patch = (status: string) => patchRequest(new Request('http://localhost/api/requests/request-1', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    }), requestContext);

    it('cannot move a request out of submitted', async () => {
        expect((await patch('in_progress')).status).toBe(409);
        expect(mocks.updateStatus).not.toHaveBeenCalled();
    });

    it('cannot mark a request submitted', async () => {
        mocks.requestById.mockResolvedValue({ ...stored, status: 'sent' });
        expect((await patch('submitted')).status).toBe(409);
        expect(mocks.updateStatus).not.toHaveBeenCalled();
    });

    it('still allows changes between open statuses', async () => {
        mocks.requestById.mockResolvedValue({ ...stored, status: 'sent' });
        mocks.updateStatus.mockResolvedValue({ ...stored, status: 'in_progress' });
        expect((await patch('in_progress')).status).toBe(200);
    });
});
