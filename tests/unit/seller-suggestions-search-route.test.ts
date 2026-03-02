import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/neon/queries', () => ({
    getRequestBySellerToken: vi.fn(),
    getRequestByToken: vi.fn(),
}));

vi.mock('@/lib/providers/suggestion-service', () => ({
    searchProviders: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
    aiRatelimit: {},
    checkRateLimit: vi.fn(),
    getRateLimitHeaders: vi.fn(() => ({})),
    isRateLimitUnavailable: vi.fn(() => false),
}));

vi.mock('@/lib/address/structured-address', () => ({
    lazyBackfillRequestStructuredAddress: vi.fn(),
}));

import { GET } from '@/app/api/seller/[token]/suggestions/search/route';
import { getRequestBySellerToken, getRequestByToken } from '@/lib/neon/queries';
import { searchProviders } from '@/lib/providers/suggestion-service';
import { checkRateLimit } from '@/lib/rate-limit';

describe('GET /api/seller/[token]/suggestions/search', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(checkRateLimit).mockResolvedValue({
            success: true,
            limit: 20,
            remaining: 19,
            reset: 999999,
        } as never);
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
            'seller-token:1.2.3.4',
            { requirePersistent: false }
        );
        expect(searchProviders).toHaveBeenCalledWith(
            'duke',
            'electric',
            '123 Main St, Raleigh, NC 27601',
            {
                requestId: 'r1',
                accountId: 'acct-1',
                organizationId: 'org-1',
            }
        );
        expect(await res.json()).toEqual([{ display_name: 'Duke Energy', confidence: 0.9 }]);
    });
});
