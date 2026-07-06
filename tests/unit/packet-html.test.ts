import { describe, expect, it } from 'vitest';
import { buildPacketPdfHtml } from '@/lib/pdf/packet-html';

describe('buildPacketPdfHtml meter number rendering', () => {
    it('uses vector print rendering for both simple and advanced mode', () => {
        const base = {
            request: {
                id: 'req_strategy',
                property_address: '123 Main St, Town, ST 00000',
                created_at: '2026-01-01T00:00:00.000Z',
            },
            brand: null,
            utilities: [],
        };

        // Default (no mode) is simple; it now matches the advanced quality bar.
        expect(buildPacketPdfHtml(base).renderStrategy).toBe('print_pdf');
        expect(buildPacketPdfHtml({ ...base, mode: 'simple' }).renderStrategy).toBe('print_pdf');
        expect(buildPacketPdfHtml({ ...base, mode: 'advanced' }).renderStrategy).toBe('print_pdf');
    });

    it('gives the simple PDF a fluid print layout with page-number/powered-by chrome', () => {
        const result = buildPacketPdfHtml({
            mode: 'simple',
            request: {
                id: 'req_simple_print',
                property_address: '123 Main St, Town, ST 00000',
                created_at: '2026-01-01T00:00:00.000Z',
            },
            brand: null,
            utilities: [],
        });

        expect(result.renderStrategy).toBe('print_pdf');
        expect(result.footerTemplate).toContain('Powered by utilitysheet.com');
        expect(result.footerTemplate).toContain('pageNumber');
        expect(result.footerTemplate).toContain('totalPages');
        expect(result.headerTemplate).toBeTruthy();
        // Fluid letter-page document, not the old fixed 800px screenshot target.
        expect(result.html).not.toContain('width: 800px');
        expect(result.html).toContain('page-break-inside: avoid');
    });

    it('renders meter number only for electric utility rows when provided', () => {
        const result = buildPacketPdfHtml({
            request: {
                id: 'req_1',
                property_address: '123 Main St, Town, ST 00000',
                created_at: '2026-01-01T00:00:00.000Z',
            },
            brand: null,
            utilities: [
                {
                    category: 'electric',
                    provider_name: 'Example Electric',
                    provider_phone: '555-123-4567',
                    provider_website: 'https://electric.example.com',
                    meter_number: 'ELEC-12345',
                },
                {
                    category: 'water',
                    provider_name: 'Town Water',
                    provider_phone: '555-555-5555',
                    provider_website: 'https://water.example.com',
                    meter_number: 'WATER-999',
                },
            ],
        });

        expect(result.html).toContain('ELEC-12345');
        expect(result.html).toContain('Meter #:');

        const meterLabelMatches = result.html.match(/Meter #:/g) || [];
        expect(meterLabelMatches).toHaveLength(1);
    });

    it('omits meter number line when electric meter number is blank', () => {
        const result = buildPacketPdfHtml({
            request: {
                id: 'req_2',
                property_address: '456 Oak St, Town, ST 00000',
                created_at: '2026-01-01T00:00:00.000Z',
            },
            brand: null,
            utilities: [
                {
                    category: 'electric',
                    provider_name: 'Example Electric',
                    meter_number: '   ',
                },
            ],
        });

        expect(result.html).not.toContain('Meter #:');
    });

    it('advanced mode does not render inline footer element', () => {
        const result = buildPacketPdfHtml({
            mode: 'advanced',
            request: {
                id: 'req_adv_1',
                property_address: '100 Test St, Town, ST 00000',
                created_at: '2026-01-01T00:00:00.000Z',
            },
            brand: null,
            utilities: [],
        });

        expect(result.html).not.toContain('class="packet-footer"');
        expect(result.html).not.toContain('<footer');
        expect(result.footerTemplate).toContain('Powered by utilitysheet.com');
        expect(result.footerTemplate).toContain('pageNumber');
    });

    it('advanced mode does not include @page CSS rule', () => {
        const result = buildPacketPdfHtml({
            mode: 'advanced',
            request: {
                id: 'req_adv_2',
                property_address: '200 Test St, Town, ST 00000',
                created_at: '2026-01-01T00:00:00.000Z',
            },
            brand: null,
            utilities: [],
        });

        expect(result.html).not.toContain('@page');
    });

    it('renders trash and recycling schedule details for trash rows', () => {
        const result = buildPacketPdfHtml({
            request: {
                id: 'req_3',
                property_address: '789 Pine St, Town, ST 00000',
                created_at: '2026-01-01T00:00:00.000Z',
            },
            brand: null,
            utilities: [
                {
                    category: 'trash',
                    provider_name: 'City Waste',
                    trash_details: {
                        has_recycling: 'yes',
                        trash_pickup_day: 'thu',
                        recycling_pickup_day: 'fri',
                    },
                },
            ],
        });

        expect(result.html).toContain('Recycling: Yes');
        expect(result.html).toContain('Trash pickup: Thursday');
        expect(result.html).toContain('Recycling pickup: Friday');
    });

    it('renders multiple trash pickup days when provided', () => {
        const result = buildPacketPdfHtml({
            request: {
                id: 'req_4',
                property_address: '789 Pine St, Town, ST 00000',
                created_at: '2026-01-01T00:00:00.000Z',
            },
            brand: null,
            utilities: [
                {
                    category: 'trash',
                    provider_name: 'City Waste',
                    trash_details: {
                        has_recycling: 'yes',
                        trash_pickup_days: ['mon', 'thu'],
                        trash_pickup_day: 'mon',
                        recycling_pickup_day: 'fri',
                    },
                },
            ],
        });

        expect(result.html).toContain('Trash pickup: Monday, Thursday');
        expect(result.html).toContain('Recycling pickup: Friday');
    });
});
