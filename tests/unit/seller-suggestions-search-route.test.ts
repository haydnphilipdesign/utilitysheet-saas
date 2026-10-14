import { createEventLog } from '@/lib/neon/queries/event-logs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/neon/queries', () => ({
    getRequestBySellerToken: vi.fn(),
    getRequestByToken: vi.fn(),
}));

const searchMocks = vi.hoisted(() => ({ searchProviders: vi.fn() }));
vi.mock('@/lib/providers/suggestion-service', () => ({
    searchProviders: searchMocks.searchProviders,
    searchProvidersResult: async (...args: unknown[]) => ({ results: await searchMocks.searchProviders(...args) }),
}));

vi.mock('@/lib/neon/queries/event-logs', () => ({ createEventLog: vi.fn(async () => undefined) }));

vi.mock('@/lib/rate-limit', () => ({
    aiRatelimit: {},
    checkRateLimit: vi.fn(),
    getRateLimitHeaders: vi.fn(() => ({})),
    isRateLimitUnavailable: vi.fn((result: { reason?: string }) => result.reason === 'unavailable'),
}));

vi.mock('@/lib/address/structured-address', () => ({
    lazyBackfillRequestStructuredAddress: vi.fn(),
}));

import { GET } from '@/app/api/seller/[token]/suggestions/search/route';
import { getRequestBySellerToken, getRequestByToken } from '@/lib/neon/queries';
import { searchProviders } from '@/lib/providers/suggestion-service';
import { checkRateLimit } from '@/lib/rate-limit';
import { capabilityRateLimitIdentifier } from '@/lib/rate-limit-identifier';

describe('GET /api/seller/[token]/suggestions/search', () => {
    it.each([['limited', 429], ['unavailable', 503]] as const)('preserves %s enforcement before provider search', async (reason, status) => {
        vi.mocked(getRequestBySellerToken).mockResolvedValue({ id: 'r1', account_id: 'acct-1', property_address: '123 Test Street' } as never);
        vi.mocked(checkRateLimit).mockResolvedValue({ success: false, limit: 20, remaining: 0, reset: 12345, reason });
        const response = await GET(new Request('http://localhost/api/seller/seller-token/suggestions/search?category=electric&query=test'), { params: Promise.resolve({ token: 'seller-token' }) });
        expect(response.status).toBe(status);
        expect(searchProviders).not.toHaveBeenCalled();
    });
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(checkRateLimit).mockResolvedValue({
            success: true,
            limit: 20,
            remaining: 19,
            reset: 999999,
        } as never);
    });

    it.each(['reject', 'slow'] as const)('preserves provider output without repeating generation when observation is %s', async (failure) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        vi.mocked(getRequestBySellerToken).mockResolvedValue({ id: 'r1', account_id: 'acct-1', property_address: '123 Main St, Raleigh, NC 27601', utility_categories: ['electric'] } as never);
        const result = [{"display_name":"Fixture Electric","confidence":0.9}];
        vi.mocked(searchProviders).mockResolvedValueOnce(result as never);
        if (failure === 'reject') vi.mocked(createEventLog).mockRejectedValueOnce(new Error('private sentinel'));
        else vi.mocked(createEventLog).mockImplementationOnce(() => new Promise(() => {}));
        const response = await GET(new Request('http://localhost/api/seller/seller-token/suggestions/search?query=fixture&category=electric'), { params: Promise.resolve({ token: 'seller-token' }) });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(result);
        expect(searchProviders).toHaveBeenCalledTimes(1);
        expect(createEventLog).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(warn.mock.calls)).not.toContain('private sentinel');
        warn.mockRestore();
    });

    it('returns 404 for unknown token', async () => {
        vi.mocked(getRequestBySellerToken).mockResolvedValue(null);
        vi.mocked(getRequestByToken).mockResolvedValue(null);

        const req = new Request('http://localhost/api/seller/missing/suggestions/search?query=duke&category=electric');
        const res = await GET(req, { params: Promise.resolve({ token: 'missing' }) });

        expect(res.status).toBe(404);
    });

    it('rejects packet/public token when seller token is required', async () => {
        vi.mocked(getRequestBySellerToken).mockResolvedValue(null);
        vi.mocked(getRequestByToken).mockResolvedValue({
            id: 'r1',
            seller_token: 'seller-token',
            public_token: 'public-token',
            account_id: 'acct-1',
            organization_id: 'org-1',
            property_address: '123 Main St, Raleigh, NC',
        } as never);

        const req = new Request('http://localhost/api/seller/public-token/suggestions/search?query=duke&category=electric');
        const res = await GET(req, { params: Promise.resolve({ token: 'public-token' }) });

        expect(res.status).toBe(404);
    });

    it('returns 400 for invalid category', async () => {
        vi.mocked(getRequestBySellerToken).mockResolvedValue({
            id: 'r1',
            seller_token: 'seller-token',
            public_token: 'public-token',
            account_id: 'acct-1',
            organization_id: 'org-1',
            property_address: '123 Main St, Raleigh, NC',
            property_address_structured: null,
        } as never);

        const req = new Request('http://localhost/api/seller/seller-token/suggestions/search?query=duke&category=invalid');
        const res = await GET(req, { params: Promise.resolve({ token: 'seller-token' }) });

        expect(res.status).toBe(400);
    });

    it('uses server-side property address and token+ip rate-limit key', async () => {
        vi.mocked(getRequestBySellerToken).mockResolvedValue({
            id: 'r1',
            seller_token: 'seller-token',
            public_token: 'public-token',
            account_id: 'acct-1',
            organization_id: 'org-1',
            property_address: '123 Main St, Raleigh, NC 27601',
            property_address_structured: null,
        } as never);
        vi.mocked(searchProviders).mockResolvedValue([{ display_name: 'Duke Energy', confidence: 0.9 }] as never);

        const req = new Request('http://localhost/api/seller/seller-token/suggestions/search?query=duke&category=electric&address=ignored', {
            headers: {
                'x-vercel-forwarded-for': '1.2.3.4',
            },
        });

        const res = await GET(req, { params: Promise.resolve({ token: 'seller-token' }) });
        expect(res.status).toBe(200);

        expect(checkRateLimit).toHaveBeenCalledWith(
            expect.anything(),
            capabilityRateLimitIdentifier('seller-ai', 'seller-token:1.2.3.4'),
            { requirePersistent: false }
        );
        expect(searchProviders).toHaveBeenCalledWith(
            'duke',
            'electric',
            '123 Main St, Raleigh, NC 27601',
            {
                requestId: 'r1',
                accountId: 'acct-1',
                organizationId: 'org-1', editVersion: 0, mode: 'live',
            }
        );
        expect(await res.json()).toEqual([{ display_name: 'Duke Energy', confidence: 0.9 }]);
        expect(vi.mocked(createEventLog).mock.calls.at(-1)?.[0]).toMatchObject({
            eventType: 'suggestions_search',
            eventData: { category: 'electric', query_length: 4, result_count: 1 },
        });
        expect(JSON.stringify(vi.mocked(createEventLog).mock.calls)).not.toMatch(/Duke Energy|duke/);
    });
});
