import { describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@/lib/neon/queries', () => ({
    getRequestByToken: vi.fn(),
    getRequestById: vi.fn(),
    getBrandProfile: vi.fn(),
    getUtilityEntriesByRequestId: vi.fn(),
    getDefaultBrandProfile: vi.fn(),
    getAccountById: vi.fn(),
    getOrganizationById: vi.fn(),
    getIntakeLinkByAccountId: vi.fn(),
}));

import { GET } from '@/app/api/packet/[token]/route';
import {
    getAccountById,
    getBrandProfile,
    getDefaultBrandProfile,
    getIntakeLinkByAccountId,
    getRequestByToken,
    getUtilityEntriesByRequestId,
} from '@/lib/neon/queries';

describe('GET /api/packet/[token]', () => {
    it('returns advanced branding fields for Pro accounts', async () => {
        (getRequestByToken as Mock).mockResolvedValue({
            id: 'req_1',
            account_id: 'acct_1',
            organization_id: null,
            brand_profile_id: 'brand_1',
            property_address: '123 Main St, Town, ST 00000',
            created_at: '2026-01-01T00:00:00.000Z',
            status: 'submitted',
        });

        (getBrandProfile as Mock).mockResolvedValue({
            id: 'brand_1',
            account_id: 'acct_1',
            organization_id: null,
            name: 'My Brand',
            logo_url: null,
            primary_color: '#10b981',
            disclaimer_text: 'My disclaimer',
            contact_email: 'me@example.com',
            contact_phone: '555-555-5555',
            contact_website: 'https://example.com',
            buyer_next_steps: ['  Step A  ', 'Step B'],
            next_steps_title: 'Next for Buyers',
            show_powered_by: false,
            show_generation_date: false,
            welcome_message: 'Hi!',
        });

        (getDefaultBrandProfile as Mock).mockResolvedValue(null);
        (getUtilityEntriesByRequestId as Mock).mockResolvedValue([]);
        (getAccountById as Mock).mockResolvedValue({ subscription_status: 'pro' });
        (getIntakeLinkByAccountId as Mock).mockResolvedValue(null);

        const response = await GET(new Request('http://localhost/api/packet/token_1'), {
            params: Promise.resolve({ token: 'token_1' }),
        });

        expect(response.status).toBe(200);
        const body = await response.json();

        expect(body.brand.show_generation_date).toBe(false);
        expect(body.brand.next_steps_title).toBe('Next for Buyers');
        expect(body.brand.buyer_next_steps).toEqual(['Step A', 'Step B']);
        expect(body.brand.show_powered_by).toBe(false);
        expect(body.brand.disclaimer_text).toBe('My disclaimer');
        expect(body.meta.show_powered_by).toBe(false);
    });

    it('forces powered-by and generation date for non-Pro accounts', async () => {
        (getRequestByToken as Mock).mockResolvedValue({
            id: 'req_2',
            account_id: 'acct_2',
            organization_id: null,
            brand_profile_id: 'brand_2',
            property_address: '456 Oak St, Town, ST 00000',
            created_at: '2026-01-01T00:00:00.000Z',
            status: 'submitted',
        });

        (getBrandProfile as Mock).mockResolvedValue({
            id: 'brand_2',
            account_id: 'acct_2',
            organization_id: null,
            name: 'My Brand',
            logo_url: null,
            primary_color: '#10b981',
            disclaimer_text: 'Non-pro disclaimer',
            contact_email: 'me@example.com',
            contact_phone: '555-555-5555',
            contact_website: 'https://example.com',
            buyer_next_steps: '["Custom A"]',
            next_steps_title: 'Custom Title',
            show_powered_by: false,
            show_generation_date: false,
            welcome_message: 'Custom welcome',
        });

        (getDefaultBrandProfile as Mock).mockResolvedValue(null);
        (getUtilityEntriesByRequestId as Mock).mockResolvedValue([]);
        (getAccountById as Mock).mockResolvedValue({ subscription_status: 'free' });
        (getIntakeLinkByAccountId as Mock).mockResolvedValue({ slug: 'route-team' });

        const response = await GET(new Request('http://localhost/api/packet/token_2'), {
            params: Promise.resolve({ token: 'token_2' }),
        });

        expect(response.status).toBe(200);
        const body = await response.json();

        expect(body.brand.show_powered_by).toBe(true);
        expect(body.meta.show_powered_by).toBe(true);
        expect(body.meta.referral_code).toBe('route-team');
        expect(body.brand.show_generation_date).toBe(true);
        expect(body.brand.buyer_next_steps).toBe(null);
        expect(body.brand.next_steps_title).toBe(null);
        expect(body.brand.welcome_message).toBe(null);
        expect(body.brand.disclaimer_text).toBe('Non-pro disclaimer');
    });
});
