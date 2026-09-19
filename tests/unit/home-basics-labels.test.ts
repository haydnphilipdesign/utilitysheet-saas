import { describe, expect, it } from 'vitest';
import { buildPacketPdfHtml } from '@/lib/pdf/packet-html';
import {
    SEWER_TYPE_OPTIONS,
    WATER_SOURCE_OPTIONS,
    getHeatingTypeLabel,
    getSewerTypeLabel,
    getWaterSourceLabel,
} from '@/lib/packet/seller-questions';

describe('Home Basics display labels', () => {
    it('resolves every stored value to a readable label', () => {
        expect(getWaterSourceLabel('city')).toBe('Public Water');
        expect(getWaterSourceLabel('hoa')).toBe('Included in HOA / Condo Fee');
        expect(getSewerTypeLabel('hoa')).toBe('Included in HOA / Condo Fee');
        expect(getHeatingTypeLabel('natural_gas')).toBe('Natural Gas');
        expect(getHeatingTypeLabel('not_sure')).toBe('Not Sure');
    });

    it('humanizes an unrecognized stored value instead of exposing the raw enum', () => {
        expect(getHeatingTypeLabel('wood_stove')).toBe('wood stove');
    });

    it('states that the HOA option is about billing, not HOA membership', () => {
        // A bare "HOA / Condo" reads as "is this home in an HOA?". Answering it
        // that way skips the provider prompt, so the packet loses the provider.
        for (const options of [WATER_SOURCE_OPTIONS, SEWER_TYPE_OPTIONS]) {
            const hoa = options.find((option) => option.id === 'hoa');
            expect(hoa?.label).toMatch(/fee/i);
            expect(hoa?.hint).toBeTruthy();
        }
    });

    it('never renders a raw Home Basics enum value into the packet PDF', () => {
        const result = buildPacketPdfHtml({
            mode: 'simple',
            request: {
                id: 'req_home_basics_labels',
                property_address: '112 Morris Place, Bushkill, PA 18324',
                created_at: '2026-07-06T12:00:00.000Z',
                water_source: 'hoa',
                sewer_type: 'hoa',
                heating_type: 'natural_gas',
            },
            brand: { name: 'Multimedium Team' },
            utilities: [{ category: 'electric', provider_name: 'PPL Electric' }],
        });

        expect(result.html).toContain('Included in HOA / Condo Fee');
        expect(result.html).toContain('Natural Gas');
        expect(result.html).not.toMatch(/>\s*hoa\s*</);
        expect(result.html).not.toMatch(/>\s*natural[ _]gas\s*</);
    });
});
