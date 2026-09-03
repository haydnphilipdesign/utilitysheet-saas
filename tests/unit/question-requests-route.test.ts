import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(),
    ensureAccountActivation: vi.fn(),
    createQuestionRequest: vi.fn(),
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
    createQuestionRequest: mocks.createQuestionRequest,
}));
vi.mock('@/lib/rate-limit', () => ({
    questionRequestRatelimit: {},
    checkRateLimit: mocks.checkRateLimit,
    getRateLimitHeaders: mocks.getRateLimitHeaders,
    isRateLimitUnavailable: mocks.isRateLimitUnavailable,
}));

import { POST } from '@/app/api/question-requests/route';

function makeRequest(body: unknown) {
    return new Request('http://localhost/api/question-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('POST /api/question-requests', () => {
    beforeEach(() => {
        mocks.getUser.mockResolvedValue({ id: 'stack_user_1' });
        mocks.ensureAccountActivation.mockResolvedValue({
            account: { id: 'account_server' },
            activeOrganization: { id: 'organization_server' },
        });
        mocks.checkRateLimit.mockResolvedValue({
            success: true,
            limit: 10,
            remaining: 9,
            reset: 1234,
            reason: 'ok',
        });
        mocks.getRateLimitHeaders.mockReturnValue({
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': '9',
            'X-RateLimit-Reset': '1234',
        });
        mocks.isRateLimitUnavailable.mockReturnValue(false);
        mocks.createQuestionRequest.mockResolvedValue(undefined);
    });

    it('returns 401 when unauthenticated', async () => {
        mocks.getUser.mockResolvedValue(null);

        const response = await POST(makeRequest({
            requestedText: 'Who services the water softener?',
            context: 'settings',
        }));

        expect(response.status).toBe(401);
        expect(mocks.ensureAccountActivation).not.toHaveBeenCalled();
        expect(mocks.createQuestionRequest).not.toHaveBeenCalled();
    });

    it.each([
        ['', 'empty'],
        ['   ', 'whitespace-only'],
        ['x'.repeat(301), 'over-length'],
    ])('rejects %s text (%s)', async (requestedText) => {
        const response = await POST(makeRequest({ requestedText, context: 'settings' }));

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ code: 'INVALID_QUESTION_REQUEST' });
        expect(mocks.createQuestionRequest).not.toHaveBeenCalled();
    });

    it('rejects an invalid context', async () => {
        const response = await POST(makeRequest({
            requestedText: 'Who services the water softener?',
            context: 'seller_form',
        }));

        expect(response.status).toBe(400);
        expect(mocks.createQuestionRequest).not.toHaveBeenCalled();
    });

    it('inserts validated text with server-resolved ownership ids', async () => {
        const response = await POST(makeRequest({
            requestedText: '  Who services the water softener?  ',
            context: 'request_creation',
            packetMode: 'advanced',
        }));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ ok: true });
        expect(mocks.createQuestionRequest).toHaveBeenCalledWith({
            accountId: 'account_server',
            organizationId: 'organization_server',
            requestedText: 'Who services the water softener?',
            context: 'request_creation',
            packetMode: 'advanced',
        });
    });

    it('ignores client-supplied account and organization ids', async () => {
        const response = await POST(makeRequest({
            requestedText: 'Is there a propane tank lease?',
            context: 'settings',
            accountId: 'account_client',
            organizationId: 'organization_client',
        }));

        expect(response.status).toBe(200);
        expect(mocks.createQuestionRequest).toHaveBeenCalledWith({
            accountId: 'account_server',
            organizationId: 'organization_server',
            requestedText: 'Is there a propane tank lease?',
            context: 'settings',
            packetMode: undefined,
        });
    });

    it('returns rate-limit headers without inserting when limited', async () => {
        mocks.checkRateLimit.mockResolvedValue({
            success: false,
            limit: 10,
            remaining: 0,
            reset: 4321,
            reason: 'limited',
        });
        mocks.getRateLimitHeaders.mockReturnValue({
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': '4321',
        });

        const response = await POST(makeRequest({
            requestedText: 'Who services the water softener?',
            context: 'settings',
        }));

        expect(response.status).toBe(429);
        expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
        expect(mocks.createQuestionRequest).not.toHaveBeenCalled();
    });

    it('does not expose submitted text when persistence fails', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        mocks.createQuestionRequest.mockRejectedValue(new Error('database unavailable'));
        const requestedText = 'Door code is 2468';

        const response = await POST(makeRequest({ requestedText, context: 'settings' }));
        const body = await response.text();

        expect(response.status).toBe(500);
        expect(body).not.toContain(requestedText);
        expect(consoleError).toHaveBeenCalledWith('Failed to create question request');
        expect(consoleError.mock.calls.flat().join(' ')).not.toContain(requestedText);
    });
});
