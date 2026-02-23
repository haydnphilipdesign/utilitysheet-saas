import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/neon/queries', () => ({
    getIntakeLinkBySlug: vi.fn(),
    getAccountById: vi.fn(),
    getAccountOrganizations: vi.fn(),
    getDefaultBrandProfile: vi.fn(),
    getRequestBySellerToken: vi.fn(),
    createRequest: vi.fn(),
    createEventLog: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
    intakeStartRatelimit: {},
    checkRateLimit: vi.fn(),
    getRateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock('@/lib/address/structured-address', () => ({
    buildStructuredPropertyAddress: vi.fn(),
}));

vi.mock('@/lib/network/client-ip', () => ({
    getClientIp: vi.fn(() => '1.2.3.4'),
}));

import { POST } from '@/app/api/intake/[slug]/start/route';
import {
    createEventLog,
    createRequest,
    getAccountById,
    getAccountOrganizations,
    getDefaultBrandProfile,
    getIntakeLinkBySlug,
    getRequestBySellerToken,
} from '@/lib/neon/queries';
import { buildStructuredPropertyAddress } from '@/lib/address/structured-address';
import { checkRateLimit } from '@/lib/rate-limit';

describe('POST /api/intake/[slug]/start', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(checkRateLimit).mockResolvedValue({
            success: true,
            limit: 20,
            remaining: 19,
            reset: 999999,
        } as never);
        vi.mocked(getIntakeLinkBySlug).mockResolvedValue({
            slug: 'test-slug',
            account_id: 'acct-1',
            is_active: true,
        } as never);
        vi.mocked(getAccountById).mockResolvedValue({
            id: 'acct-1',
            role: 'user',
            active_organization_id: null,
        } as never);
        vi.mocked(getAccountOrganizations).mockResolvedValue([] as never);
        vi.mocked(getDefaultBrandProfile).mockResolvedValue(null);
        vi.mocked(getRequestBySellerToken).mockResolvedValue(null);
        vi.mocked(buildStructuredPropertyAddress).mockResolvedValue({
            street: '123 Main St',
            city: 'Austin',
            state: 'TX',
            zip: '78701',
            full: '123 Main St, Austin, TX 78701',
            confidence: 'high',
            issues: [],
            source: 'local',
        });
        vi.mocked(createRequest).mockResolvedValue({
            id: 'req-1',
            seller_token: 'seller-token-1',
        } as never);
        vi.mocked(createEventLog).mockResolvedValue(undefined as never);
    });

    it('returns 400 with missingFields when address is incomplete', async () => {
        const request = new Request('http://localhost/api/intake/test-slug/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ propertyAddress: '123 Main St, Austin, TX' }),
        });

        const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) });

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Incomplete address');
        expect(body.message).toContain('street address, city, state, and ZIP');
        expect(body.missingFields).toContain('zip');
        expect(createRequest).not.toHaveBeenCalled();
    });

    it('creates request and returns seller token for complete address', async () => {
        const request = new Request('http://localhost/api/intake/test-slug/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ propertyAddress: '123 Main St, Austin, TX 78701' }),
        });

        const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ sellerToken: 'seller-token-1' });
        expect(buildStructuredPropertyAddress).toHaveBeenCalledWith('123 Main St, Austin, TX 78701');
        expect(createRequest).toHaveBeenCalled();
    });
});
