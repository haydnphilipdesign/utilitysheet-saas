import { describe, expect, it } from 'vitest';
import { submittedSheetUpdateBodySchema } from '@/lib/validation/schemas';

describe('submittedSheetUpdateBodySchema', () => {
    it('normalizes provider URLs without a scheme', () => {
        const parsed = submittedSheetUpdateBodySchema.safeParse({
            updatedAt: '2026-03-31T12:00:00.000Z',
            propertyAddress: '123 Main St, Austin, TX 78701',
            advanced: {},
            utilities: {
                electric: {
                    providerName: 'Example Electric',
                    contactPhone: '',
                    contactUrl: 'example.com/start-service',
                    meterNumber: '  ABC-123  ',
                    trashDetails: {
                        hasRecycling: '',
                        trashPickupDay: '',
                        recyclingPickupDay: '',
                    },
                },
            },
        });

        expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues, null, 2)).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.utilities.electric.contactUrl).toBe('https://example.com/start-service');
        expect(parsed.data.utilities.electric.meterNumber).toBe('ABC-123');
    });

    it('accepts trash detail updates and preserves blank states', () => {
        const parsed = submittedSheetUpdateBodySchema.safeParse({
            updatedAt: '2026-03-31T12:00:00.000Z',
            propertyAddress: '123 Main St, Austin, TX 78701',
            advanced: {},
            utilities: {
                trash: {
                    providerName: '',
                    contactPhone: '',
                    contactUrl: '',
                    meterNumber: '',
                    trashDetails: {
                        hasRecycling: 'no',
                        trashPickupDay: 'thu',
                        trashPickupDays: ['thu', 'mon'],
                        recyclingPickupDay: '',
                    },
                },
            },
        });

        expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues, null, 2)).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.utilities.trash.trashDetails).toEqual({
            hasRecycling: 'no',
            trashPickupDay: 'thu',
            trashPickupDays: ['thu', 'mon'],
            recyclingPickupDay: '',
            recyclingPickupDays: [],
        });
    });

    it('accepts multiple recycling pickup days', () => {
        const parsed = submittedSheetUpdateBodySchema.safeParse({
            updatedAt: '2026-03-31T12:00:00.000Z',
            propertyAddress: '123 Main St, Austin, TX 78701',
            advanced: {},
            utilities: {
                trash: {
                    providerName: '',
                    contactPhone: '',
                    contactUrl: '',
                    meterNumber: '',
                    trashDetails: {
                        hasRecycling: 'yes',
                        trashPickupDay: 'thu',
                        trashPickupDays: ['thu'],
                        recyclingPickupDay: 'mon',
                        recyclingPickupDays: ['mon', 'fri'],
                    },
                },
            },
        });

        expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues, null, 2)).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.utilities.trash.trashDetails.recyclingPickupDays).toEqual(['mon', 'fri']);
    });
});
