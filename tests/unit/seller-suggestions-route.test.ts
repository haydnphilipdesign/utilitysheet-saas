import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/neon/queries', () => ({
    getRequestBySellerToken: vi.fn(),
    getRequestByToken: vi.fn(),
    getOrganizationById: vi.fn(),
}));

vi.mock('@/lib/providers/suggestion-service', () => ({
    getAllSuggestions: vi.fn(),
}));

vi.mock('@/lib/neon/queries/event-logs', () => ({
    createEventLog: vi.fn(async () => undefined),
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
import { getRequestBySellerToken, getRequestByToken, getOrganizationById } from '@/lib/neon/queries';
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

    it('returns deterministic fake providers for the UtilitySheet demo workspace', async () => {
        vi.mocked(getRequestBySellerToken).mockResolvedValue({
            id: 'demo-request',
            seller_token: 'demo-seller-token',
            public_token: 'demo-public-token',
            account_id: 'demo-account',
            organization_id: 'demo-org',
            property_address: '123 Main Street, Anytown, PA 18301',
            property_address_structured: null,
            utility_categories: ['electric', 'gas', 'water', 'sewer', 'trash', 'internet', 'cable'],
        } as never);
        vi.mocked(getOrganizationById).mockResolvedValue({
            id: 'demo-org',
            slug: 'utilitysheet-demo',
            name: 'UtilitySheet Demo',
        } as never);

        const req = new Request('http://localhost/api/seller/demo-seller-token/suggestions?categories=electric,gas,water,sewer,trash,internet,cable');
        const res = await GET(req, { params: Promise.resolve({ token: 'demo-seller-token' }) });
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.suggestions.electric[0].display_name).toBe('Keystone Electric Co.');
        expect(body.suggestions.gas[0].display_name).toBe('Valley Natural Gas');
        expect(body.suggestions.water[0].display_name).toBe('Anytown Water Authority');
        expect(body.suggestions.sewer[0].display_name).toBe('Anytown Sewer Authority');
        expect(body.suggestions.trash[0].display_name).toBe('GreenCart Waste Services');
        expect(body.suggestions.internet[0].display_name).toBe('Blue Ridge Fiber');
        expect(body.suggestions.cable[0].display_name).toBe('Blue Ridge Fiber');
        expect(getAllSuggestions).not.toHaveBeenCalled();
    });

    it('uses the normal suggestion pipeline for non-demo workspaces', async () => {
        vi.mocked(getRequestBySellerToken).mockResolvedValue({
            id: 'real-request',
            seller_token: 'real-seller-token',
            public_token: 'real-public-token',
            account_id: 'real-account',
            organization_id: 'real-org',
            property_address: '123 Main Street, Anytown, PA 18301',
            property_address_structured: null,
            utility_categories: ['electric'],
        } as never);
        vi.mocked(getOrganizationById).mockResolvedValue({
            id: 'real-org',
            slug: 'real-workspace',
            name: 'Real Workspace',
        } as never);
        vi.mocked(getAllSuggestions).mockResolvedValue({
            electric: [{ display_name: 'Normal Provider', confidence: 0.9 }],
        } as never);

        const req = new Request('http://localhost/api/seller/real-seller-token/suggestions?categories=electric');
        const res = await GET(req, { params: Promise.resolve({ token: 'real-seller-token' }) });

        expect(res.status).toBe(200);
        expect(getAllSuggestions).toHaveBeenCalledWith(
            '123 Main Street, Anytown, PA 18301',
            ['electric'],
            {
                requestId: 'real-request',
                accountId: 'real-account',
                organizationId: 'real-org',
            }
        );
    });
});
