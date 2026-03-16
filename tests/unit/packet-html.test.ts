import { describe, expect, it } from 'vitest';
import { buildPacketPdfHtml } from '@/lib/pdf/packet-html';

describe('buildPacketPdfHtml meter number rendering', () => {
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
});
