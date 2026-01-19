import { describe, expect, it } from 'vitest';
import { BRAND_PROFILE_LIMITS } from '@/lib/branding/limits';
import { brandProfileCreateBodySchema, brandProfileUpdateBodySchema } from '@/lib/validation/schemas';

describe('Brand profile schemas', () => {
    it('accepts valid create payload and strips unknown keys', () => {
        const input = {
            name: 'My Brand',
            logo_url: 'https://example.com/logo.png',
            primary_color: '#10b981',
            secondary_color: '#059669',
            contact_name: 'Jane Smith',
            contact_phone: '(555) 123-4567',
            contact_email: 'jane@example.com',
            contact_website: 'https://example.com',
            disclaimer_text: 'Disclaimer text',
            is_default: true,
            buyer_next_steps: ['Step 1', 'Step 2'],
            next_steps_title: 'Buyer Next Steps',
            show_powered_by: true,
            show_generation_date: true,
            welcome_message: 'Welcome',
            extra_field: 'should be removed',
        };

        const parsed = brandProfileCreateBodySchema.parse(input) as any;
        expect(parsed.name).toBe('My Brand');
        expect(parsed.extra_field).toBeUndefined();
    });

    it('rejects too many buyer next steps', () => {
        const input = {
            name: 'My Brand',
            primary_color: '#10b981',
            secondary_color: '#059669',
            buyer_next_steps: Array.from({ length: BRAND_PROFILE_LIMITS.buyerNextStepsMaxItems + 1 }, (_, i) => `Step ${i + 1}`),
        };

        const result = brandProfileCreateBodySchema.safeParse(input);
        expect(result.success).toBe(false);
    });

    it('rejects invalid colors', () => {
        const input = {
            name: 'My Brand',
            primary_color: 'green',
            secondary_color: '#059669',
        };

        const result = brandProfileCreateBodySchema.safeParse(input);
        expect(result.success).toBe(false);
    });

    it('allows partial updates and strips unknown keys', () => {
        const input = {
            welcome_message: 'Updated welcome',
            unknown_key: 'ignored',
        };

        const parsed = brandProfileUpdateBodySchema.parse(input) as any;
        expect(parsed.welcome_message).toBe('Updated welcome');
        expect(parsed.unknown_key).toBeUndefined();
    });
});

