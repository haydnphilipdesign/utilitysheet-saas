import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/neon/queries', () => ({
    getIntakeLinkBySlug: vi.fn(),
    getAccountById: vi.fn(),
    getAccountOrganizations: vi.fn(),
    getMonthlyUsage: vi.fn(),
    getDefaultBrandProfile: vi.fn(),
    getRequestBySellerToken: vi.fn(),
    createRequest: vi.fn(),
    createEventLog: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
    intakeStartRatelimit: {},
    checkRateLimit: vi.fn(),
    getRateLimitHeaders: vi.fn(() => ({})),
    isRateLimitUnavailable: vi.fn(() => false),
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
    getMonthlyUsage,
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
            default_packet_mode: 'simple',
            advanced_modules: [],
            advanced_module_exclusions: {},
        } as never);
        vi.mocked(getAccountById).mockResolvedValue({
            id: 'acct-1',
            role: 'user',
            subscription_status: 'free',
            active_organization_id: null,
        } as never);
        vi.mocked(getAccountOrganizations).mockResolvedValue([] as never);
        vi.mocked(getMonthlyUsage).mockResolvedValue({
            used: 0,
            limit: 3,
            plan: 'free',
        } as never);
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
        expect(body.message).toContain('house number, street address, city, state, and ZIP');
        expect(body.missingFields).toContain('zip');
        expect(createRequest).not.toHaveBeenCalled();
    });

    it('allows and logs addresses that have a street name but no house number', async () => {
        const request = new Request('http://localhost/api/intake/test-slug/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ propertyAddress: 'Oakwood Court, Middle Smithfield Township, PA 18302' }),
        });

        const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) });

        expect(response.status).toBe(200);
        expect(createRequest).toHaveBeenCalledWith(expect.objectContaining({
            propertyAddress: 'Oakwood Court, Middle Smithfield Township, PA 18302',
        }));
        expect(createEventLog).toHaveBeenCalledWith(expect.objectContaining({
            eventData: expect.objectContaining({
                submitted_property_address: 'Oakwood Court, Middle Smithfield Township, PA 18302',
                canonical_property_address: 'Oakwood Court, Middle Smithfield Township, PA 18302',
                street_has_number: false,
            }),
        }));
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
        expect(createRequest).toHaveBeenCalledWith(expect.objectContaining({
            propertyAddress: '123 Main St, Austin, TX 78701',
        }));
        expect(createEventLog).toHaveBeenCalledWith(expect.objectContaining({
            eventData: expect.objectContaining({
                submitted_property_address: '123 Main St, Austin, TX 78701',
                canonical_property_address: '123 Main St, Austin, TX 78701',
                address_was_canonicalized: false,
                street_has_number: true,
            }),
        }));
    });

    it('accepts a complete no-comma address after parser normalization', async () => {
        const request = new Request('http://localhost/api/intake/test-slug/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ propertyAddress: '135 acorn ln kunkletown pa 18058' }),
        });

        const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ sellerToken: 'seller-token-1' });
        expect(buildStructuredPropertyAddress).toHaveBeenCalledWith('135 acorn ln, Kunkletown, PA 18058');
        expect(createRequest).toHaveBeenCalledWith(expect.objectContaining({
            propertyAddress: '135 acorn ln, Kunkletown, PA 18058',
        }));
    });

    it('uses reusable-link advanced module defaults for paid accounts', async () => {
        vi.mocked(getIntakeLinkBySlug).mockResolvedValue({
            slug: 'test-slug',
            account_id: 'acct-1',
            is_active: true,
            default_packet_mode: 'advanced',
            advanced_modules: ['mailbox_access', 'service_providers'],
            advanced_module_exclusions: { service_providers: ['service_provider_notes'] },
        } as never);
        vi.mocked(getAccountById).mockResolvedValue({
            id: 'acct-1',
            role: 'user',
            subscription_status: 'pro',
            active_organization_id: null,
        } as never);

        const request = new Request('http://localhost/api/intake/test-slug/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ propertyAddress: '123 Main St, Austin, TX 78701' }),
        });

        const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) });

        expect(response.status).toBe(200);
        expect(createRequest).toHaveBeenCalledWith(expect.objectContaining({
            packetMode: 'advanced',
            advancedModules: ['mailbox_access', 'service_providers'],
            advancedModuleExclusions: { service_providers: ['service_provider_notes'] },
        }));
    });

    it('falls back to simple mode for free accounts even when reusable-link default is advanced', async () => {
        vi.mocked(getIntakeLinkBySlug).mockResolvedValue({
            slug: 'test-slug',
            account_id: 'acct-1',
            is_active: true,
            default_packet_mode: 'advanced',
            advanced_modules: ['mailbox_access', 'service_providers'],
            advanced_module_exclusions: { service_providers: ['service_provider_notes'] },
        } as never);
        vi.mocked(getAccountById).mockResolvedValue({
            id: 'acct-1',
            role: 'user',
            subscription_status: 'free',
            active_organization_id: null,
        } as never);

        const request = new Request('http://localhost/api/intake/test-slug/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ propertyAddress: '123 Main St, Austin, TX 78701' }),
        });

        const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) });

        expect(response.status).toBe(200);
        expect(createRequest).toHaveBeenCalledWith(expect.objectContaining({
            packetMode: 'simple',
            advancedModules: [],
            advancedModuleExclusions: {},
        }));
    });
});
