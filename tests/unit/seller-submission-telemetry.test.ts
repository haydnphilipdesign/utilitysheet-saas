import { describe, expect, it } from 'vitest';
import { buildSellerSubmittedEventSummary } from '@/lib/telemetry/seller-submission';

describe('seller submission telemetry summary', () => {
    it('summarizes seller submission without storing raw utility or advanced payloads', () => {
        const summary = buildSellerSubmittedEventSummary({
            water_source: 'city',
            sewer_type: 'public',
            primary_heating_type: 'electric',
            packet_mode: 'advanced',
            advanced_modules: ['mailbox_access'],
            advanced_module_exclusions: { mailbox_access: ['gate_code'] },
            advanced: {
                mailbox_access: {
                    gate_code: '1234',
                    mailbox_number: 'A-12',
                },
            },
            utilities: {
                electric: {
                    entry_mode: 'suggested_confirmed',
                    display_name: 'Acme Electric',
                    raw_text: null,
                    meter_number: 'SECRET-METER',
                },
                water: {
                    entry_mode: 'free_text',
                    display_name: 'Seller Typed Water',
                    raw_text: 'Seller Typed Water',
                },
            },
        });

        expect(summary).toEqual({
            actor: 'seller',
            packet_mode: 'advanced',
            utility_count: 2,
            utility_categories: ['electric', 'water'],
            entry_modes: {
                suggested_confirmed: 1,
                search_selected: 0,
                free_text: 1,
                unknown: 0,
            },
            advanced_module_count: 1,
            advanced_modules: ['mailbox_access'],
            advanced_exclusion_count: 1,
            water_source: 'city',
            sewer_type: 'public',
            heating_type: 'electric',
        });

        const serialized = JSON.stringify(summary);
        expect(serialized).not.toContain('Acme Electric');
        expect(serialized).not.toContain('Seller Typed Water');
        expect(serialized).not.toContain('SECRET-METER');
        expect(serialized).not.toContain('1234');
    });
});
