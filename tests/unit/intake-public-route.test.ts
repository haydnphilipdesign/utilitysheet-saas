import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/neon/queries', () => ({
    getIntakeLinkBySlug: vi.fn(),
    getAccountById: vi.fn(),
    getAccountOrganizations: vi.fn(),
    getIntakeBrandProfile: vi.fn(),
    normalizeIntakeUtilityCategories: vi.fn((value: unknown) => (
        Array.isArray(value) && value.length > 0
            ? value
            : ['electric', 'gas', 'propane', 'oil', 'water', 'sewer', 'trash', 'internet', 'cable']
    )),
}));

import { GET } from '@/app/api/intake/[slug]/route';
import {
    getAccountById,
    getAccountOrganizations,
    getIntakeBrandProfile,
    getIntakeLinkBySlug,
} from '@/lib/neon/queries';

describe('GET /api/intake/[slug]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getIntakeLinkBySlug).mockResolvedValue({
            slug: 'test-slug',
            account_id: 'acct-1',
            is_active: true,
            default_brand_profile_id: 'brand-2',
            default_utility_categories: ['electric', 'water', 'internet'],
        } as never);
        vi.mocked(getAccountById).mockResolvedValue({
            id: 'acct-1',
            role: 'user',
            active_organization_id: null,
        } as never);
        vi.mocked(getAccountOrganizations).mockResolvedValue([] as never);
        vi.mocked(getIntakeBrandProfile).mockResolvedValue({
            id: 'brand-2',
            name: 'Agent Brand',
            logo_url: 'https://example.com/logo.png',
            primary_color: '#123456',
            contact_email: 'agent@example.com',
            contact_phone: '555-0100',
            contact_website: 'https://example.com',
        } as never);
    });

    it('returns the saved public Branding Profile and utility categories', async () => {
        const response = await GET(new Request('http://localhost/api/intake/test-slug'), {
            params: Promise.resolve({ slug: 'test-slug' }),
        });

        expect(response.status).toBe(200);
        expect(getIntakeBrandProfile).toHaveBeenCalledWith('acct-1', undefined, 'brand-2');
        expect(await response.json()).toEqual({
            accepting: true,
            brandProfile: {
                name: 'Agent Brand',
                logo_url: 'https://example.com/logo.png',
                primary_color: '#123456',
                contact_email: 'agent@example.com',
                contact_phone: '555-0100',
                contact_website: 'https://example.com',
            },
            utility_categories: ['electric', 'water', 'internet'],
        });
    });

    it('returns a generic 404 without loading private data when paused', async () => {
        vi.mocked(getIntakeLinkBySlug).mockResolvedValue({
            slug: 'test-slug',
            account_id: 'acct-1',
            is_active: false,
        } as never);

        const response = await GET(new Request('http://localhost/api/intake/test-slug'), {
            params: Promise.resolve({ slug: 'test-slug' }),
        });

        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ error: 'Not found' });
        expect(getAccountById).not.toHaveBeenCalled();
        expect(getIntakeBrandProfile).not.toHaveBeenCalled();
    });
});
