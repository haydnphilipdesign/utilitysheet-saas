import { describe, expect, it } from 'vitest';
import {
    getEffectiveAdvancedModules,
    normalizeAdvancedModuleExclusions,
} from '@/lib/packet/modules';

describe('advanced module exclusions normalization', () => {
    it('drops unknown modules and unknown fields, and deduplicates known field keys', () => {
        const normalized = normalizeAdvancedModuleExclusions({
            mailbox_access: [
                'mailbox_number',
                'mailbox_number',
                'unknown_field',
            ],
            fake_module: ['something'],
        });

        expect(normalized).toEqual({
            mailbox_access: ['mailbox_number'],
        });
    });

    it('drops exclusions for modules that are not enabled', () => {
        const normalized = normalizeAdvancedModuleExclusions(
            {
                mailbox_access: ['mailbox_number'],
                service_providers: ['service_provider_notes'],
            },
            ['service_providers']
        );

        expect(normalized).toEqual({
            service_providers: ['service_provider_notes'],
        });
    });

    it('omits modules with zero included fields from effective module list', () => {
        const effective = getEffectiveAdvancedModules(
            ['mailbox_access', 'service_providers'],
            {
                mailbox_access: [
                    'mailbox_number',
                    'mailbox_location',
                    'parking_instructions',
                    'breaker_box_location',
                    'main_water_shutoff_location',
                ],
            }
        );

        expect(effective).toEqual(['service_providers']);
    });
});
