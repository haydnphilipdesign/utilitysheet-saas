import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/neon/queries', () => ({
    getRequestBySellerToken: vi.fn(),
    getRequestByToken: vi.fn(),
}));

vi.mock('@/lib/providers/suggestion-service', () => ({
    getAllSuggestions: vi.fn(),
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

import { GET } from '@/app/api/seller/[token]/suggestions/route';
import { getRequestBySellerToken, getRequestByToken } from '@/lib/neon/queries';
import { getAllSuggestions } from '@/lib/providers/suggestion-service';
import { checkRateLimit } from '@/lib/rate-limit';

describe('GET /api/seller/[token]/suggestions', () => {
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

        const req = new Request('http://localhost/api/seller/missing/suggestions?categories=electric');
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

        const req = new Request('http://localhost/api/seller/public-token/suggestions?categories=electric');
        const res = await GET(req, { params: Promise.resolve({ token: 'public-token' }) });

        expect(res.status).toBe(404);
    });

    it('returns 400 when category list is missing', async () => {
        vi.mocked(getRequestBySellerToken).mockResolvedValue({
            id: 'r1',
            seller_token: 'seller-token',
            public_token: 'public-token',
            account_id: 'acct-1',
            organization_id: 'org-1',
            property_address: '123 Main St, Raleigh, NC',
            property_address_structured: null,
            utility_categories: ['electric'],
        } as never);

        const req = new Request('http://localhost/api/seller/seller-token/suggestions');
        const res = await GET(req, { params: Promise.resolve({ token: 'seller-token' }) });

        expect(res.status).toBe(400);
    });

    it('passes context to getAllSuggestions', async () => {
        vi.mocked(getRequestBySellerToken).mockResolvedValue({
            id: 'r1',
            seller_token: 'seller-token',
            public_token: 'public-token',
            account_id: 'acct-1',
            organization_id: 'org-1',
            property_address: '123 Main St, Raleigh, NC 27601',
            property_address_structured: null,
            utility_categories: ['electric', 'water'],
        } as never);
        vi.mocked(getAllSuggestions).mockResolvedValue({
            electric: [{ display_name: 'Duke Energy', confidence: 0.9 }],
        } as never);

        const req = new Request('http://localhost/api/seller/seller-token/suggestions?categories=electric');
        const res = await GET(req, { params: Promise.resolve({ token: 'seller-token' }) });

        expect(res.status).toBe(200);
        expect(getAllSuggestions).toHaveBeenCalledWith(
            '123 Main St, Raleigh, NC 27601',
            ['electric'],
            {
                requestId: 'r1',
                accountId: 'acct-1',
                organizationId: 'org-1',
            }
        );
    });
});
