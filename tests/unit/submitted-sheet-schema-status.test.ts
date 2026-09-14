import { describe, expect, it } from 'vitest';
import { submittedSheetUpdateBodySchema } from '@/lib/validation/schemas';

const emptyTrash = { hasRecycling: '', trashPickupDay: '', recyclingPickupDay: '' };

function body(utilities: Record<string, unknown>, extra: Record<string, unknown> = {}) {
    return {
        updatedAt: '2026-09-14T12:00:00.000Z',
        propertyAddress: '1418 Briarcliff Road, Charlotte, NC 28207',
        advanced: {},
        utilities,
        ...extra,
    };
}

describe('submittedSheetUpdateBodySchema utility status and home basics', () => {
    it('requires a provider name when the status is provider', () => {
        const parsed = submittedSheetUpdateBodySchema.safeParse(body({
            trash: { status: 'provider', providerName: '   ', contactPhone: '', contactUrl: '', meterNumber: '', trashDetails: emptyTrash },
        }));
        expect(parsed.success).toBe(false);
    });

    it('accepts explicit "Not sure" and "Not included" statuses', () => {
        const parsed = submittedSheetUpdateBodySchema.safeParse(body({
            gas: { status: 'not_sure', providerName: '', contactPhone: '', contactUrl: '', meterNumber: '', trashDetails: emptyTrash },
            internet: { status: 'not_included', providerName: '', contactPhone: '', contactUrl: '', meterNumber: '', trashDetails: emptyTrash },
        }));
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.utilities.gas.status).toBe('not_sure');
        expect(parsed.data.utilities.internet.status).toBe('not_included');
    });

    it('infers a status for payloads from an editor loaded before statuses existed', () => {
        const parsed = submittedSheetUpdateBodySchema.safeParse(body({
            electric: { providerName: 'Duke Energy', contactPhone: '', contactUrl: '', meterNumber: '', trashDetails: emptyTrash },
            trash: { providerName: '', contactPhone: '', contactUrl: '', meterNumber: '', trashDetails: { ...emptyTrash, trashPickupDays: ['tue'] } },
            gas: { providerName: '', contactPhone: '', contactUrl: '', meterNumber: '', trashDetails: emptyTrash },
        }));
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.utilities.electric.status).toBe('provider');
        expect(parsed.data.utilities.trash.status).toBe('not_sure');
        expect(parsed.data.utilities.gas.status).toBe('not_included');
        expect(parsed.data.homeBasics).toBeUndefined();
    });

    it('normalizes blank home basics to null and rejects unknown values', () => {
        const valid = submittedSheetUpdateBodySchema.safeParse(body({}, {
            homeBasics: { waterSource: 'well', sewerType: '', heatingType: null },
        }));
        expect(valid.success).toBe(true);
        if (valid.success) {
            expect(valid.data.homeBasics).toEqual({ waterSource: 'well', sewerType: null, heatingType: null });
        }

        const invalid = submittedSheetUpdateBodySchema.safeParse(body({}, {
            homeBasics: { waterSource: 'river', sewerType: null, heatingType: null },
        }));
        expect(invalid.success).toBe(false);
    });
});
