import { describe, expect, it } from 'vitest';
import { sellerSubmissionBodySchema } from '@/lib/validation/schemas';

describe('sellerSubmissionBodySchema', () => {
    const basePayload = {
        water_source: 'not_sure',
        sewer_type: 'not_sure',
        heating_type: 'not_sure',
        fuels_present: [] as string[],
        primary_heating_type: null as string | null,
        trash_handled_by: 'not_sure' as const,
        utilities: {},
    };

    it('accepts an empty utilities map', () => {
        const parsed = sellerSubmissionBodySchema.safeParse(basePayload);
        expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues, null, 2)).toBe(true);
    });

    it('accepts partial utility entries and fills missing fields', () => {
        const parsed = sellerSubmissionBodySchema.safeParse({
            ...basePayload,
            utilities: {
                electric: {
                    entry_mode: 'unknown',
                },
            },
        });

        expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues, null, 2)).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.utilities.electric.display_name).toBeNull();
        expect(parsed.data.utilities.electric.raw_text).toBeNull();
        expect(parsed.data.utilities.electric.meter_number).toBeNull();
        expect(parsed.data.utilities.electric.hidden).toBe(false);
    });

    it('normalizes contact_url without scheme', () => {
        const parsed = sellerSubmissionBodySchema.safeParse({
            ...basePayload,
            utilities: {
                electric: {
                    entry_mode: 'suggested_confirmed',
                    display_name: 'Example Power',
                    raw_text: null,
                    contact_url: 'www.example.com/start-service',
                },
            },
        });

        expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues, null, 2)).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.utilities.electric.contact_url).toBe('https://www.example.com/start-service');
    });

    it('preserves AI suggestion metadata needed for later correlation', () => {
        const parsed = sellerSubmissionBodySchema.safeParse({
            ...basePayload,
            utilities: {
                electric: {
                    entry_mode: 'suggested_confirmed',
                    display_name: 'Example Power',
                    raw_text: null,
                    canonical_id: 'example-power',
                    confidence_score: 0.87,
                },
            },
        });

        expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues, null, 2)).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.utilities.electric.canonical_id).toBe('example-power');
        expect(parsed.data.utilities.electric.confidence_score).toBe(0.87);
    });

    it('normalizes electric meter_number by trimming whitespace', () => {
        const parsed = sellerSubmissionBodySchema.safeParse({
            ...basePayload,
            utilities: {
                electric: {
                    entry_mode: 'search_selected',
                    display_name: 'Example Power',
                    raw_text: null,
                    meter_number: '  ABC-12345  ',
                },
            },
        });

        expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues, null, 2)).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.utilities.electric.meter_number).toBe('ABC-12345');
    });

    it('rejects electric meter_number values over 64 characters', () => {
        const parsed = sellerSubmissionBodySchema.safeParse({
            ...basePayload,
            utilities: {
                electric: {
                    entry_mode: 'search_selected',
                    display_name: 'Example Power',
                    raw_text: null,
                    meter_number: 'x'.repeat(65),
                },
            },
        });

        expect(parsed.success).toBe(false);
    });

    it('normalizes trash/recycling extra fields', () => {
        const parsed = sellerSubmissionBodySchema.safeParse({
            ...basePayload,
            utilities: {
                trash: {
                    entry_mode: 'search_selected',
                    display_name: 'City Waste',
                    raw_text: null,
                    extra: {
                        has_recycling: 'YES',
                        trash_pickup_day: 'THU',
                        recycling_pickup_day: 'fri',
                        ignored_field: 'drop me',
                    },
                },
            },
        });

        expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues, null, 2)).toBe(true);
        if (!parsed.success) return;

        expect(parsed.data.utilities.trash.extra).toEqual({
            has_recycling: 'yes',
            trash_pickup_day: 'thu',
            recycling_pickup_day: 'fri',
        });
    });

    it('clears recycling pickup day when has_recycling is no', () => {
        const parsed = sellerSubmissionBodySchema.safeParse({
            ...basePayload,
            utilities: {
                trash: {
                    entry_mode: 'search_selected',
                    display_name: 'City Waste',
                    raw_text: null,
                    extra: {
                        has_recycling: 'no',
                        trash_pickup_day: 'wed',
                        recycling_pickup_day: 'thu',
                    },
                },
            },
        });

        expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues, null, 2)).toBe(true);
        if (!parsed.success) return;

        expect(parsed.data.utilities.trash.extra).toEqual({
            has_recycling: 'no',
            trash_pickup_day: 'wed',
            recycling_pickup_day: null,
        });
    });

    it('accepts advanced packet payload fields when provided', () => {
        const parsed = sellerSubmissionBodySchema.safeParse({
            ...basePayload,
            packet_mode: 'advanced',
            advanced_modules: ['mailbox_access', 'service_providers'],
            advanced: {
                mailbox_access: {
                    mailbox_number: 'A-12',
                    parking_instructions: 'Use guest parking by Building B',
                },
                service_providers: {
                    hvac_provider_name: 'Cool Air Co',
                    plumber_provider_phone: '(555) 111-2222',
                },
            },
            utilities: {
                electric: {
                    entry_mode: 'unknown',
                },
            },
        });

        expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues, null, 2)).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.packet_mode).toBe('advanced');
        expect(parsed.data.advanced_modules).toEqual(['mailbox_access', 'service_providers']);
        expect(parsed.data.advanced?.mailbox_access?.mailbox_number).toBe('A-12');
    });
});
