// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/neon/queries', () => ({
    getRequestBySellerToken: vi.fn(),
    getRequestByToken: vi.fn(),
}));
vi.mock('@/lib/neon/queries/seller-observations', () => ({ insertSellerObservations: vi.fn(async () => 1) }));
vi.mock('@/lib/rate-limit', () => ({
    sellerObservationRatelimit: { name: 'seller-observation-policy' },
    checkRateLimit: vi.fn(),
    getRateLimitHeaders: vi.fn(() => ({ 'X-RateLimit-Limit': '60' })),
    isRateLimitUnavailable: vi.fn((result: { reason?: string }) => result.reason === 'unavailable'),
}));

import { POST } from '@/app/api/seller/[token]/observations/route';
import { getRequestBySellerToken, getRequestByToken } from '@/lib/neon/queries';
import { insertSellerObservations } from '@/lib/neon/queries/seller-observations';
import { checkRateLimit, sellerObservationRatelimit } from '@/lib/rate-limit';
import { capabilityRateLimitIdentifier } from '@/lib/rate-limit-identifier';

const TOKEN = 'synthetic-seller-capability-token-sentinel';
const SESSION = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const EVENT_ID = '11111111-2222-4333-8444-555555555555';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1 sentinel-ua';
const validBody = {
    v: 1, session: SESSION, edit_version: 0,
    events: [
        { type: 'seller_step_viewed', id: EVENT_ID, seq: 3, step: 'utility', category: 'electric', nav: 'linear', visit: 'first' },
        { type: 'seller_submission_failed', id: '66666666-7777-4888-8999-000000000000', seq: 4, attempt: 1, error_code: 'rate_limited', status: 429, duration: '1_3s' },
    ],
};

function post(body: unknown, token: string = TOKEN, headers: Record<string, string> = {}) {
    return POST(new Request(`http://localhost/api/seller/${token}/observations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'user-agent': UA, 'x-real-ip': '203.0.113.9', ...headers },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    }), { params: Promise.resolve({ token }) });
}

const liveRequest = { id: 'request-1', account_id: 'account-1', seller_token: TOKEN, public_token: 'packet-token', is_demo: false, seller_edit_version: 0, status: 'in_progress', property_address: '12 Sentinel Street' };

describe('POST /api/seller/[token]/observations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(checkRateLimit).mockResolvedValue({ success: true, limit: 60, remaining: 59, reset: 1, reason: 'ok' });
        vi.mocked(getRequestBySellerToken).mockResolvedValue(liveRequest as never);
        vi.mocked(getRequestByToken).mockResolvedValue(null as never);
        vi.mocked(insertSellerObservations).mockResolvedValue(2);
    });

    it('stores only allowlisted fields against the server-resolved request and mode', async () => {
        const response = await post(validBody);
        expect(response.status).toBe(202);
        expect(await response.json()).toEqual({ ok: true });

        expect(insertSellerObservations).toHaveBeenCalledTimes(1);
        const [params, options] = vi.mocked(insertSellerObservations).mock.calls[0];
        expect(options?.signal).toBeInstanceOf(AbortSignal);
        expect(params.requestId).toBe('request-1');
        expect(params.rows).toEqual([
            { eventType: 'seller_step_viewed', eventId: EVENT_ID, eventData: {
                v: 1, actor: 'seller_browser', mode: 'live', session_id: SESSION, event_id: EVENT_ID, seq: 3, edit_version: 0,
                device: 'mobile', browser: 'safari', step: 'utility', category: 'electric', nav: 'linear', visit: 'first' } },
            { eventType: 'seller_submission_failed', eventId: '66666666-7777-4888-8999-000000000000', eventData: expect.objectContaining({
                mode: 'live', attempt: 1, error_code: 'rate_limited', status: 429, duration: '1_3s' }) },
        ]);
        const stored = JSON.stringify(params);
        for (const sentinel of [TOKEN, 'sentinel-ua', '203.0.113.9', 'Sentinel Street', 'account-1']) expect(stored).not.toContain(sentinel);
    });

    it('marks test-drive requests as test regardless of the body', async () => {
        vi.mocked(getRequestBySellerToken).mockResolvedValue({ ...liveRequest, is_demo: true } as never);
        expect((await post(validBody)).status).toBe(202);
        expect(vi.mocked(insertSellerObservations).mock.calls[0][0].rows.every(row => row.eventData.mode === 'test')).toBe(true);
    });

    it('limits by a hashed token and IP before reading the body or the request', async () => {
        await post(validBody);
        const [policy, identifier, options] = vi.mocked(checkRateLimit).mock.calls[0];
        expect(policy).toBe(sellerObservationRatelimit);
        expect(identifier).toBe(capabilityRateLimitIdentifier('seller-observation', `${TOKEN}:203.0.113.9`));
        expect(identifier).not.toContain(TOKEN);
        expect(options).toEqual({ requirePersistent: false });
    });

    it.each([['limited', 429], ['unavailable', 503]] as const)('fails closed when %s, before any lookup or write', async (reason, status) => {
        vi.mocked(checkRateLimit).mockResolvedValue({ success: false, limit: 60, remaining: 0, reset: 1, reason });
        const response = await post(validBody);
        expect(response.status).toBe(status);
        expect(getRequestBySellerToken).not.toHaveBeenCalled();
        expect(insertSellerObservations).not.toHaveBeenCalled();
    });

    it.each([
        ['malformed JSON', '{not json'],
        ['an unknown field', { ...validBody, events: [{ ...validBody.events[0], answer: 'Sentinel Electric' }] }],
        ['client-supplied identity', { ...validBody, request_id: 'request-2' }],
        ['an empty batch', { ...validBody, events: [] }],
    ])('rejects %s without a lookup or write', async (_label, body) => {
        const response = await post(body);
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: 'Invalid observation', code: 'INVALID_SELLER_OBSERVATION' });
        expect(getRequestBySellerToken).not.toHaveBeenCalled();
        expect(insertSellerObservations).not.toHaveBeenCalled();
    });

    it('rejects an oversized body by declared and by actual length', async () => {
        expect((await post(validBody, TOKEN, { 'content-length': '9000' })).status).toBe(413);
        expect((await post(JSON.stringify({ ...validBody, pad: 'x'.repeat(9000) }))).status).toBe(413);
        expect(insertSellerObservations).not.toHaveBeenCalled();
    });

    it('returns 404 for an unknown, overlong or packet-only link', async () => {
        vi.mocked(getRequestBySellerToken).mockResolvedValue(null as never);
        expect((await post(validBody, 'unknown-link')).status).toBe(404);

        expect((await post(validBody, 'x'.repeat(201))).status).toBe(404);

        // The packet (read) link resolves the request but must not grant this write.
        vi.mocked(getRequestByToken).mockResolvedValue(liveRequest as never);
        expect((await post(validBody, 'packet-token')).status).toBe(404);
        expect(insertSellerObservations).not.toHaveBeenCalled();
    });

    it('ignores an editing session the request has not reached', async () => {
        const response = await post({ ...validBody, edit_version: 3 });
        expect(response.status).toBe(202);
        expect(insertSellerObservations).not.toHaveBeenCalled();

        vi.mocked(getRequestBySellerToken).mockResolvedValue({ ...liveRequest, seller_edit_version: 3 } as never);
        expect((await post({ ...validBody, edit_version: 3 })).status).toBe(202);
        expect(vi.mocked(insertSellerObservations).mock.calls[0][0].rows[0].eventData.edit_version).toBe(3);
    });

    it.each(['reject', 'slow'] as const)('still answers 202 once when the write is %s, with one redacted marker', async (failure) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        if (failure === 'reject') vi.mocked(insertSellerObservations).mockRejectedValueOnce(new Error(`private sentinel ${TOKEN}`));
        else vi.mocked(insertSellerObservations).mockImplementationOnce(() => new Promise(() => {}));
        const response = await post(validBody);
        expect(response.status).toBe(202);
        expect(insertSellerObservations).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toBe('[diagnostic] auxiliary_write_failed');
        expect(warn.mock.calls[0][1]).toMatchObject({ observation: 'seller_observation', reason: failure === 'slow' ? 'deadline' : 'write_failed' });
        expect(JSON.stringify(warn.mock.calls)).not.toContain('sentinel');
        warn.mockRestore();
    });

    it('answers a lookup failure with a generic 500 and a redacted diagnostic', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.mocked(getRequestBySellerToken).mockRejectedValueOnce(new Error(`private sentinel ${TOKEN}`));
        const response = await post(validBody);
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ error: 'Failed to record observation' });
        expect(error.mock.calls[0][0]).toBe('[diagnostic] seller_observation_failed');
        expect(JSON.stringify(error.mock.calls)).not.toContain('sentinel');
        error.mockRestore();
    });
});
