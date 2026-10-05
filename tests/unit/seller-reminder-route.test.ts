// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(),
    getOrCreateAccount: vi.fn(),
    getRequestById: vi.fn(),
    getBrandProfile: vi.fn(),
    canAccess: vi.fn(),
    checkRateLimit: vi.fn(),
    claim: vi.fn(),
    finalize: vi.fn(),
    recordOutcome: vi.fn(),
    resendSend: vi.fn(),
}));

vi.mock('@/lib/stack/server', () => ({ stackServerApp: { getUser: mocks.getUser } }));
vi.mock('@/lib/neon/queries', () => ({
    getOrCreateAccount: mocks.getOrCreateAccount,
    getRequestById: mocks.getRequestById,
    getBrandProfile: mocks.getBrandProfile,
}));
vi.mock('@/lib/auth/organization-access', () => ({ canAccessOwnedOrActiveOrganizationResource: mocks.canAccess }));
vi.mock('@/lib/rate-limit', () => ({
    reminderRatelimit: {},
    checkRateLimit: mocks.checkRateLimit,
    getRateLimitHeaders: () => ({ 'X-RateLimit-Remaining': '4' }),
    isRateLimitUnavailable: (result: { unavailable?: boolean }) => result.unavailable === true,
}));
vi.mock('@/lib/network/client-ip', () => ({ getClientIpOrNull: () => '198.51.100.7' }));
vi.mock('@/lib/pdf/packet-attachment', () => ({ createPacketPdfAttachmentForRequest: vi.fn() }));
vi.mock('@/lib/resend', () => ({ getResend: () => ({ emails: { send: mocks.resendSend } }) }));
vi.mock('@/lib/neon/statements', async (original) => ({
    ...(await original<typeof import('@/lib/neon/statements')>()),
    getStatementExecutor: () => ({ run: vi.fn(), transaction: vi.fn() }),
}));
vi.mock('@/lib/neon/queries/reminder-operations', async (original) => ({
    ...(await original<typeof import('@/lib/neon/queries/reminder-operations')>()),
    claimReminderOperation: mocks.claim,
    finalizeReminderAccepted: mocks.finalize,
    recordReminderOutcome: mocks.recordOutcome,
}));

import { POST } from '@/app/api/requests/[id]/remind/route';
import { buildSellerReminderEmail, sendSellerReminderEmail } from '@/lib/email/email-service';
import { buildReminderForRequest, fingerprintReminderEmail } from '@/lib/reminders/seller-reminder';
import type { BrandProfile, Request as SellerRequest } from '@/types';

const REQUEST_ID = '33333333-3333-4333-8333-333333333333';
const account = { id: 'acct-1', full_name: 'Olivia Owner' };
const requestRecord = {
    id: REQUEST_ID, account_id: 'acct-1', property_address: '1 Open St <b>', seller_name: 'Sam Seller',
    seller_email: 'sam@example.com', seller_token: 'seller-capability-token', public_token: 'pub', status: 'submitted',
    brand_profile_id: null, closing_date: null,
} as unknown as SellerRequest;

const post = () => POST(
    new Request(`http://localhost/api/requests/${REQUEST_ID}/remind`, { method: 'POST', headers: { 'user-agent': 'vitest' } }),
    { params: Promise.resolve({ id: REQUEST_ID }) }
);

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    mocks.getUser.mockResolvedValue({ id: 'auth-1', primaryEmail: 'owner@example.com', displayName: 'Olivia' });
    mocks.getOrCreateAccount.mockResolvedValue(account);
    mocks.getRequestById.mockResolvedValue(requestRecord);
    mocks.canAccess.mockResolvedValue(true);
    mocks.checkRateLimit.mockResolvedValue({ success: true });
    mocks.claim.mockResolvedValue({ outcome: 'CLAIMED', blockingOperationId: null, retryAfterSeconds: null });
    mocks.finalize.mockResolvedValue({ finalized: true });
    mocks.recordOutcome.mockResolvedValue({ recorded: true });
    mocks.resendSend.mockResolvedValue({ data: { id: 'msg_1' }, error: null });
});

describe('customer reminder endpoint', () => {
    it('keeps authentication, ownership and rate limiting ahead of any claim or send', async () => {
        mocks.getUser.mockResolvedValueOnce(null);
        expect((await post()).status).toBe(401);
        mocks.canAccess.mockResolvedValueOnce(false);
        expect((await post()).status).toBe(403);
        mocks.checkRateLimit.mockResolvedValueOnce({ success: false });
        expect((await post()).status).toBe(429);
        mocks.checkRateLimit.mockResolvedValueOnce({ unavailable: true });
        expect((await post()).status).toBe(503);
        mocks.getRequestById.mockResolvedValueOnce(null);
        expect((await post()).status).toBe(404);
        expect(mocks.claim).not.toHaveBeenCalled();
        expect(mocks.resendSend).not.toHaveBeenCalled();
    });

    it('claims as the agent, sends with the operation key, then records one accepted reminder', async () => {
        const response = await post();
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ success: true });

        const claim = mocks.claim.mock.calls[0][0];
        expect(claim).toMatchObject({
            requestId: REQUEST_ID, recipientEmail: 'sam@example.com',
            actor: { type: 'agent', accountId: 'acct-1', ipAddress: '198.51.100.7', userAgent: 'vitest' },
        });
        // The customer path keeps its existing eligibility: a submitted request can still be reminded.
        expect(mocks.resendSend).toHaveBeenCalledWith(
            expect.objectContaining({ to: 'sam@example.com', from: 'UtilitySheet <noreply@utilitysheet.com>' }),
            { idempotencyKey: `seller-reminder/${claim.operationId}` }
        );
        expect(mocks.finalize).toHaveBeenCalledWith(expect.objectContaining({
            operationId: claim.operationId, providerMessageId: 'msg_1', admin: null,
        }));
    });

    it('returns the existing cooldown contract without contacting the provider', async () => {
        mocks.claim.mockResolvedValueOnce({ outcome: 'COOLDOWN', blockingOperationId: null, retryAfterSeconds: 421 });
        const response = await post();
        expect(response.status).toBe(429);
        expect(response.headers.get('Retry-After')).toBe('421');
        expect(await response.json()).toMatchObject({ code: 'REMINDER_COOLDOWN_ACTIVE', retryAfterSeconds: 421 });
        expect(mocks.resendSend).not.toHaveBeenCalled();
    });

    it('reports in-flight and unresolved operations as conflicts, never as a fresh send', async () => {
        mocks.claim.mockResolvedValueOnce({ outcome: 'IN_FLIGHT', blockingOperationId: 'x', retryAfterSeconds: null });
        const inFlight = await post();
        expect([inFlight.status, (await inFlight.json()).code]).toEqual([409, 'REMINDER_IN_PROGRESS']);
        mocks.claim.mockResolvedValueOnce({ outcome: 'UNRESOLVED', blockingOperationId: 'x', retryAfterSeconds: null });
        const unresolved = await post();
        expect([unresolved.status, (await unresolved.json()).code]).toEqual([409, 'REMINDER_OUTCOME_PENDING']);
        expect(mocks.resendSend).not.toHaveBeenCalled();
    });

    it('separates provider rejection, ambiguous timeout and accepted-but-unrecorded', async () => {
        mocks.resendSend.mockResolvedValueOnce({ data: null, error: { name: 'validation_error', message: 'Invalid `to` field: sam@' } });
        const rejected = await post();
        const rejectedBody = await rejected.json();
        expect(rejected.status).toBe(500);
        expect(rejectedBody).toEqual({ error: 'Failed to send reminder' });
        expect(mocks.recordOutcome).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'failed', failureCode: 'validation_error' }));

        mocks.resendSend.mockRejectedValueOnce(new Error('socket hang up'));
        const unknown = await post();
        expect([unknown.status, (await unknown.json()).code]).toEqual([502, 'REMINDER_OUTCOME_UNKNOWN']);
        expect(mocks.recordOutcome).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'unknown' }));

        mocks.finalize.mockRejectedValueOnce(new Error('db write failed'));
        const unrecorded = await post();
        expect(unrecorded.status).toBe(200);
        expect(await unrecorded.json()).toEqual({ success: true });
    });

    it('fails closed, without sending, while the operations table is missing', async () => {
        mocks.claim.mockRejectedValueOnce(Object.assign(new Error('relation "reminder_operations" does not exist'), { code: '42P01' }));
        const response = await post();
        expect(response.status).toBe(503);
        expect(JSON.stringify(await response.json())).not.toContain('reminder_operations');
        expect(mocks.resendSend).not.toHaveBeenCalled();
    });
});

describe('shared reminder rendering', () => {
    const brand = {
        name: 'North Star <TC>', contact_name: 'Nora North', contact_email: 'nora@example.com', primary_color: 'javascript:alert(1)',
        logo_url: 'javascript:alert(1)', message_templates: { seller_reminder: { email: { subject: 'Reminder for {{property_address}}' } } },
    } as unknown as BrandProfile;

    it('builds the same payload for preview and send, and the fingerprint follows every sent field', () => {
        const first = buildReminderForRequest(requestRecord, brand, 'Fallback Agent');
        const second = buildReminderForRequest(requestRecord, brand, 'Fallback Agent');
        expect(second).toEqual(first);
        expect(first.email).toMatchObject({ to: 'sam@example.com', replyTo: 'nora@example.com' });
        expect(first.email.html).toContain('/s/seller-capability-token');
        // Escaping and safe asset handling are preserved.
        expect(first.email.html).toContain('1 Open St &lt;b&gt;');
        expect(first.email.html).not.toContain('javascript:alert');

        for (const change of [{ to: 'other@example.com' }, { subject: 'x' }, { html: 'x' }, { replyTo: null }]) {
            expect(fingerprintReminderEmail({ ...first.email, ...change })).not.toBe(first.fingerprint);
        }
        expect(first.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    });

    it('leaves the seller return-link and branding test callers on the plain send path with no idempotency key', async () => {
        const params = {
            sellerEmail: 'sam@example.com', propertyAddress: '1 Open St', sellerToken: 'tok', brandProfile: brand,
        };
        const result = await sendSellerReminderEmail(params);
        expect(result).toMatchObject({ success: true, messageId: 'msg_1' });
        const built = buildSellerReminderEmail(params);
        expect(mocks.resendSend).toHaveBeenCalledWith(
            { from: built.from, to: built.to, subject: built.subject, html: built.html, replyTo: 'nora@example.com' },
            undefined
        );
    });
});
