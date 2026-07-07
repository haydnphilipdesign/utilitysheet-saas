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

        const parsed = brandProfileCreateBodySchema.parse(input) as Record<string, unknown>;
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

        const parsed = brandProfileUpdateBodySchema.parse(input) as Record<string, unknown>;
        expect(parsed.welcome_message).toBe('Updated welcome');
        expect(parsed.unknown_key).toBeUndefined();
    });

    describe('explicit clear semantics on update', () => {
        it('keeps omitted fields undefined (leave unchanged)', () => {
            const parsed = brandProfileUpdateBodySchema.parse({ name: 'Acme' }) as Record<string, unknown>;
            expect('logo_url' in parsed).toBe(false);
            expect('buyer_next_steps' in parsed).toBe(false);
        });

        it('passes explicit null through for clearable fields (clear this value)', () => {
            const parsed = brandProfileUpdateBodySchema.parse({
                logo_url: null,
                contact_website: null,
                disclaimer_text: null,
                next_steps_title: null,
                welcome_message: null,
                buyer_next_steps: null,
            }) as Record<string, unknown>;

            expect(parsed.logo_url).toBeNull();
            expect(parsed.contact_website).toBeNull();
            expect(parsed.disclaimer_text).toBeNull();
            expect(parsed.next_steps_title).toBeNull();
            expect(parsed.welcome_message).toBeNull();
            expect(parsed.buyer_next_steps).toBeNull();
        });

        it('normalizes empty and whitespace-only strings to null (clear)', () => {
            const parsed = brandProfileUpdateBodySchema.parse({
                contact_name: '',
                contact_phone: '   ',
                welcome_message: '',
            }) as Record<string, unknown>;

            expect(parsed.contact_name).toBeNull();
            expect(parsed.contact_phone).toBeNull();
            expect(parsed.welcome_message).toBeNull();
        });

        it('treats an empty or all-blank buyer steps list as a reset to defaults', () => {
            expect((brandProfileUpdateBodySchema.parse({ buyer_next_steps: [] }) as Record<string, unknown>).buyer_next_steps).toBeNull();
            expect((brandProfileUpdateBodySchema.parse({ buyer_next_steps: ['  ', ''] }) as Record<string, unknown>).buyer_next_steps).toBeNull();
        });

        it('trims and keeps non-empty buyer steps', () => {
            const parsed = brandProfileUpdateBodySchema.parse({
                buyer_next_steps: ['  Call the utility  ', '', 'Confirm service'],
            }) as Record<string, unknown>;
            expect(parsed.buyer_next_steps).toEqual(['Call the utility', 'Confirm service']);
        });

        it('still rejects overlong values after trimming', () => {
            const result = brandProfileUpdateBodySchema.safeParse({
                buyer_next_steps: ['x'.repeat(BRAND_PROFILE_LIMITS.buyerNextStepMax + 1)],
            });
            expect(result.success).toBe(false);
        });
    });
});

