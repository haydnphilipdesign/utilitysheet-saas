import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(),
    ensureAccountActivation: vi.fn(),
    createFeedbackSubmission: vi.fn(),
    setFeedbackEmailStatus: vi.fn(),
    sendFeedbackEmail: vi.fn(),
    checkRateLimit: vi.fn(),
    getRateLimitHeaders: vi.fn(),
    isRateLimitUnavailable: vi.fn(),
}));

vi.mock('@/lib/stack/server', () => ({
    stackServerApp: { getUser: mocks.getUser },
}));
vi.mock('@/lib/activation/ensure-account-activation', () => ({
    ensureAccountActivation: mocks.ensureAccountActivation,
}));
vi.mock('@/lib/neon/queries', () => ({
    createFeedbackSubmission: mocks.createFeedbackSubmission,
    setFeedbackEmailStatus: mocks.setFeedbackEmailStatus,
}));
vi.mock('@/lib/email/email-service', () => ({
    sendFeedbackEmail: mocks.sendFeedbackEmail,
}));
vi.mock('@/lib/rate-limit', () => ({
    feedbackRatelimit: {},
    checkRateLimit: mocks.checkRateLimit,
    getRateLimitHeaders: mocks.getRateLimitHeaders,
    isRateLimitUnavailable: mocks.isRateLimitUnavailable,
}));

import { POST } from '@/app/api/feedback/route';

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
    return new Request('http://localhost/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
    });
}

describe('POST /api/feedback', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUser.mockResolvedValue({ id: 'stack_user_1', primaryEmail: 'tc@example.com', displayName: 'Sample TC' });
        mocks.ensureAccountActivation.mockResolvedValue({
            account: { id: 'account_server' },
            activeOrganization: { id: 'organization_server' },
        });
        mocks.checkRateLimit.mockResolvedValue({ success: true, limit: 5, remaining: 4, reset: 1234, reason: 'ok' });
        mocks.getRateLimitHeaders.mockReturnValue({ 'X-RateLimit-Remaining': '4' });
        mocks.isRateLimitUnavailable.mockReturnValue(false);
        mocks.createFeedbackSubmission.mockResolvedValue('feedback_1');
        mocks.setFeedbackEmailStatus.mockResolvedValue(undefined);
        mocks.sendFeedbackEmail.mockResolvedValue({ success: true });
    });

    it('returns 401 when unauthenticated', async () => {
        mocks.getUser.mockResolvedValue(null);

        const response = await POST(makeRequest({ message: 'Hello' }));

        expect(response.status).toBe(401);
        expect(mocks.createFeedbackSubmission).not.toHaveBeenCalled();
        expect(mocks.sendFeedbackEmail).not.toHaveBeenCalled();
    });

    it.each([
        ['', 'empty'],
        ['   ', 'whitespace-only'],
        ['x'.repeat(2001), 'over-length'],
    ])('rejects %s message (%s)', async (message) => {
        const response = await POST(makeRequest({ message }));

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ code: 'INVALID_FEEDBACK_BODY' });
        expect(mocks.createFeedbackSubmission).not.toHaveBeenCalled();
        expect(mocks.sendFeedbackEmail).not.toHaveBeenCalled();
    });

    it('rejects an unknown category', async () => {
        const response = await POST(makeRequest({ message: 'Hello', category: 'complaint' }));

        expect(response.status).toBe(400);
        expect(mocks.createFeedbackSubmission).not.toHaveBeenCalled();
    });

    it('stores the message with server-resolved ownership and context, then notifies by email', async () => {
        const response = await POST(makeRequest(
            {
                message: '  The PDF button does nothing  ',
                category: 'bug',
                pagePath: '/dashboard/requests/abc',
                viewport: '390x844',
                accountId: 'account_client',
                organizationId: 'organization_client',
            },
            { 'user-agent': 'TestBrowser/1.0' }
        ));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ success: true });
        expect(mocks.createFeedbackSubmission).toHaveBeenCalledWith({
            accountId: 'account_server',
            organizationId: 'organization_server',
            category: 'bug',
            message: 'The PDF button does nothing',
            pagePath: '/dashboard/requests/abc',
            viewport: '390x844',
            userAgent: 'TestBrowser/1.0',
        });
        expect(mocks.sendFeedbackEmail).toHaveBeenCalledWith(expect.objectContaining({
            userEmail: 'tc@example.com',
            category: 'bug',
            pagePath: '/dashboard/requests/abc',
            stored: true,
        }));
        expect(mocks.setFeedbackEmailStatus).toHaveBeenCalledWith('feedback_1', 'sent');
    });

    it('defaults the category and drops malformed context instead of rejecting the message', async () => {
        const response = await POST(makeRequest({
            message: 'Love it',
            pagePath: 'https://evil.example/?token=secret',
            viewport: 'huge',
        }));

        expect(response.status).toBe(200);
        expect(mocks.createFeedbackSubmission).toHaveBeenCalledWith(expect.objectContaining({
            category: 'general',
            pagePath: null,
            viewport: null,
        }));
    });

    it('drops a page path that carries a query string', async () => {
        await POST(makeRequest({ message: 'Hello', pagePath: '/dashboard?token=secret' }));

        expect(mocks.createFeedbackSubmission).toHaveBeenCalledWith(expect.objectContaining({ pagePath: null }));
    });

    it('returns 429 without storing or emailing when limited', async () => {
        mocks.checkRateLimit.mockResolvedValue({ success: false, limit: 5, remaining: 0, reset: 4321, reason: 'limited' });
        mocks.getRateLimitHeaders.mockReturnValue({ 'X-RateLimit-Remaining': '0' });

        const response = await POST(makeRequest({ message: 'Hello' }));

        expect(response.status).toBe(429);
        expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
        expect(mocks.checkRateLimit).toHaveBeenCalledWith(expect.anything(), 'account_server');
        expect(mocks.createFeedbackSubmission).not.toHaveBeenCalled();
        expect(mocks.sendFeedbackEmail).not.toHaveBeenCalled();
    });

    it('succeeds and records the failed notice when the row is stored but the email fails', async () => {
        mocks.sendFeedbackEmail.mockResolvedValue({ success: false, error: 'Configuration error' });

        const response = await POST(makeRequest({ message: 'Hello' }));

        expect(response.status).toBe(200);
        expect(mocks.setFeedbackEmailStatus).toHaveBeenCalledWith('feedback_1', 'failed');
    });

    it('falls back to email when storage fails, without logging the message', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        mocks.createFeedbackSubmission.mockRejectedValue(new Error('relation "feedback_submissions" does not exist'));
        const message = 'Door code is 2468';

        const response = await POST(makeRequest({ message }));

        expect(response.status).toBe(200);
        expect(mocks.sendFeedbackEmail).toHaveBeenCalledWith(expect.objectContaining({ message, stored: false }));
        expect(mocks.setFeedbackEmailStatus).not.toHaveBeenCalled();
        expect(consoleError.mock.calls.flat().join(' ')).not.toContain(message);
        consoleError.mockRestore();
    });

    it('returns 500 without exposing the message when neither storage nor email works', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        mocks.createFeedbackSubmission.mockResolvedValue(null);
        mocks.sendFeedbackEmail.mockResolvedValue({ success: false, error: 'provider down' });
        const message = 'Door code is 2468';

        const response = await POST(makeRequest({ message }));
        const body = await response.text();

        expect(response.status).toBe(500);
        expect(body).not.toContain(message);
        consoleError.mockRestore();
    });
});
