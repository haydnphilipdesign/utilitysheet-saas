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
        (checkRateLimit as any).mockResolvedValue({
            success: true,
            limit: 20,
            remaining: 19,
            reset: 999999,
        });
    });

    it('returns 404 for unknown token', async () => {
        (getRequestBySellerToken as any).mockResolvedValue(null);
        (getRequestByToken as any).mockResolvedValue(null);

        const req = new Request('http://localhost/api/seller/missing/suggestions/search?query=duke&category=electric');
        const res = await GET(req, { params: Promise.resolve({ token: 'missing' }) });

        expect(res.status).toBe(404);
    });

    it('rejects packet/public token when seller token is required', async () => {
        (getRequestBySellerToken as any).mockResolvedValue(null);
        (getRequestByToken as any).mockResolvedValue({
            id: 'r1',
            seller_token: 'seller-token',
            public_token: 'public-token',
            property_address: '123 Main St, Raleigh, NC',
        });

        const req = new Request('http://localhost/api/seller/public-token/suggestions/search?query=duke&category=electric');
        const res = await GET(req, { params: Promise.resolve({ token: 'public-token' }) });

        expect(res.status).toBe(404);
    });

    it('returns 400 for invalid category', async () => {
        (getRequestBySellerToken as any).mockResolvedValue({
            id: 'r1',
            seller_token: 'seller-token',
            public_token: 'public-token',
            property_address: '123 Main St, Raleigh, NC',
            property_address_structured: null,
        });

        const req = new Request('http://localhost/api/seller/seller-token/suggestions/search?query=duke&category=invalid');
        const res = await GET(req, { params: Promise.resolve({ token: 'seller-token' }) });

        expect(res.status).toBe(400);
    });

    it('uses server-side property address and token+ip rate-limit key', async () => {
        (getRequestBySellerToken as any).mockResolvedValue({
            id: 'r1',
            seller_token: 'seller-token',
            public_token: 'public-token',
            property_address: '123 Main St, Raleigh, NC 27601',
            property_address_structured: null,
        });
        (searchProviders as any).mockResolvedValue([{ display_name: 'Duke Energy', confidence: 0.9 }]);

        const req = new Request('http://localhost/api/seller/seller-token/suggestions/search?query=duke&category=electric&address=ignored', {
            headers: {
                'x-forwarded-for': '1.2.3.4, 5.6.7.8',
            },
        });

        const res = await GET(req, { params: Promise.resolve({ token: 'seller-token' }) });
        expect(res.status).toBe(200);

        expect(checkRateLimit).toHaveBeenCalledWith(expect.anything(), 'seller-token:1.2.3.4');
        expect(searchProviders).toHaveBeenCalledWith('duke', 'electric', '123 Main St, Raleigh, NC 27601');
        expect(await res.json()).toEqual([{ display_name: 'Duke Energy', confidence: 0.9 }]);
    });
});
