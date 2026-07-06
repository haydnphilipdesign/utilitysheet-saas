import { describe, expect, it } from 'vitest';
import { buildPacketPdfHtml } from '@/lib/pdf/packet-html';
import { BRAND_PROFILE_LIMITS } from '@/lib/branding/limits';

describe('buildPacketPdfHtml shared packet PDF rendering', () => {
    it('uses the shared document shell and content blocks in advanced mode', () => {
        const result = buildPacketPdfHtml({
            mode: 'advanced',
            request: {
                id: 'req_shared_advanced',
                property_address: '112 Morris Place, Bushkill, PA 18324',
                created_at: '2026-07-06T12:00:00.000Z',
                water_source: 'city',
                sewer_type: 'septic',
                heating_type: 'electric',
            },
            brand: {
                name: 'Multimedium Team',
                contact_name: 'Haydn Watkins',
            },
            utilities: [{ category: 'electric', provider_name: 'PPL Electric' }],
            advanced_sections: [{
                key: 'access',
                title: 'Access Details',
                fields: [{ key: 'garage', label: 'Garage Code', value: '1234' }],
            }],
        });

        expect(result.html).toContain('class="packet-pdf"');
        expect(result.html).toMatch(/class="brand-mark"[^>]*>\s*MT\s*</);
        expect(result.html).toContain('Haydn Watkins');
        expect(result.html).toContain('Home Basics');
        expect(result.html).toContain('class="section-heading accent-heading"');
        expect(result.html).toContain('Utility Providers');
        expect(result.html).toContain('Buyer Next Steps');
        expect(result.html).not.toContain('font-family: "Georgia"');
    });

    it.each(['simple', 'advanced'] as const)('uses shared shell classes in %s mode', (mode) => {
        const result = buildPacketPdfHtml({
            mode,
            request: {
                id: `req_shared_${mode}`,
                property_address: '112 Morris Place, Bushkill, PA 18324',
                created_at: '2026-07-06T12:00:00.000Z',
                water_source: 'city',
            },
            brand: { name: 'Multimedium Team' },
            utilities: [{ category: 'water', provider_name: 'Town Water' }],
            advanced_sections: mode === 'advanced' ? [{
                key: 'access',
                title: 'Access Details',
                fields: [{ key: 'garage', label: 'Garage Code', value: '1234' }],
            }] : [],
        });

        for (const className of [
            'packet-pdf',
            'brand-header',
            'title-block',
            'accent-heading',
            'provider-table',
            'buyer-steps-section',
        ]) {
            expect(result.html).toContain(className);
        }
    });

    it.each(['simple', 'advanced'] as const)('normalizes the brand contact website in %s mode', (mode) => {
        const result = buildPacketPdfHtml({
            mode,
            request: {
                id: `req_contact_website_${mode}`,
                property_address: '112 Morris Place, Bushkill, PA 18324',
                created_at: '2026-07-06T12:00:00.000Z',
            },
            brand: {
                name: 'Multimedium Team',
                contact_website: 'https://Example.com/path',
            },
            utilities: [],
        });

        expect(result.html).toContain('>example.com</p>');
        expect(result.html).not.toContain('https://Example.com/path');
    });

    it.each(['simple', 'advanced'] as const)('displays a schemeless brand contact website in %s mode', (mode) => {
        const result = buildPacketPdfHtml({
            mode,
            request: {
                id: `req_schemeless_contact_website_${mode}`,
                property_address: '112 Morris Place, Bushkill, PA 18324',
                created_at: '2026-07-06T12:00:00.000Z',
            },
            brand: {
                name: 'Multimedium Team',
                contact_website: 'yourrealty.com',
            },
            utilities: [],
        });

        expect(result.html).toContain('>yourrealty.com</p>');
    });

    it.each(['simple', 'advanced'] as const)('omits explicit non-http brand contact schemes in %s mode', (mode) => {
        for (const contactWebsite of [
            'javascript:alert(1)',
            'data:text/html,unsafe',
            'mailto:agent@example.com',
            'ftp://example.com/file',
        ]) {
            const result = buildPacketPdfHtml({
                mode,
                request: {
                    id: `req_unsafe_contact_website_${mode}`,
                    property_address: '112 Morris Place, Bushkill, PA 18324',
                    created_at: '2026-07-06T12:00:00.000Z',
                },
                brand: {
                    name: 'Multimedium Team',
                    contact_website: contactWebsite,
                },
                utilities: [],
            });

            expect(result.html).not.toContain(contactWebsite);
            expect(result.html).not.toMatch(/brand-contact-line">(?:javascript|data|mailto|ftp)/);
        }
    });

    it.each(['simple', 'advanced'] as const)('limits the normalized brand contact website in %s mode', (mode) => {
        const hostname = `${'a'.repeat(63)}.${'b'.repeat(63)}.com`;
        const expectedDisplay = `${hostname.slice(0, BRAND_PROFILE_LIMITS.contactWebsiteMax - 1)}…`;
        const result = buildPacketPdfHtml({
            mode,
            request: {
                id: `req_contact_website_limit_${mode}`,
                property_address: '112 Morris Place, Bushkill, PA 18324',
                created_at: '2026-07-06T12:00:00.000Z',
            },
            brand: {
                name: 'Multimedium Team',
                contact_website: `https://${hostname}/path`,
            },
            utilities: [],
        });

        expect(expectedDisplay).toHaveLength(BRAND_PROFILE_LIMITS.contactWebsiteMax);
        expect(result.html).toContain(`>${expectedDisplay}</p>`);
        expect(result.html).not.toContain(hostname);
    });

    it('uses the canonical document title for simple and advanced HTML', () => {
        const base = {
            request: {
                id: 'req_title',
                property_address: '123 Main St, Town, ST 00000',
                created_at: '2026-01-01T00:00:00.000Z',
            },
            brand: null,
            utilities: [],
        };

        expect(buildPacketPdfHtml({ ...base, mode: 'simple' }).html)
            .toContain('<title>Utility Info Sheet</title>');
        expect(buildPacketPdfHtml({ ...base, mode: 'advanced' }).html)
            .toContain('<title>Utility Info Sheet</title>');
    });

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

    it('uses a repeating provider heading group without keeping the full table together', () => {
        const result = buildPacketPdfHtml({
            mode: 'simple',
            request: {
                id: 'req_simple_pagination',
                property_address: '112 Morris Place, Bushkill, PA 18324',
                created_at: '2026-07-06T12:00:00.000Z',
                water_source: 'city',
                sewer_type: 'septic',
                heating_type: 'electric',
            },
            brand: { name: 'Multimedium Team' },
            utilities: Array.from({ length: 5 }, (_, index) => ({
                category: ['electric', 'internet', 'propane', 'trash', 'water'][index],
                provider_name: `Provider ${index + 1}`,
            })),
        });

        expect(result.html).toContain('class="packet-pdf"');
        expect(result.html).toMatch(/<thead>[\s\S]*provider-section-title[\s\S]*Utility Providers[\s\S]*provider-columns/);
        expect(result.html).toContain('thead { display: table-header-group; }');
        expect(result.html).toContain('.provider-row { break-inside: avoid;');
        expect(result.html).not.toContain('provider-table keep-together');
    });

    it('renders advanced details as a page-aware table with an empty partner for odd fields', () => {
        const result = buildPacketPdfHtml({
            mode: 'advanced',
            request: {
                id: 'req_advanced_pagination',
                property_address: '112 Morris Place, Bushkill, PA 18324',
                created_at: '2026-07-06T12:00:00.000Z',
            },
            brand: { name: 'Multimedium Team' },
            utilities: [{ category: 'electric', provider_name: 'PPL Electric' }],
            advanced_sections: [{
                key: 'access',
                title: 'Mailbox & Home Access',
                fields: [
                    { key: 'mailbox', label: 'Mailbox Location', value: 'End of driveway' },
                    { key: 'garage', label: 'Garage Code', value: '1234' },
                    { key: 'gate', label: 'Gate Code', value: '5678' },
                    { key: 'keys', label: 'Spare Keys', value: 'Kitchen drawer' },
                    { key: 'alarm', label: 'Alarm Code', value: '2468' },
                ],
            }],
        });

        expect(result.html).toMatch(
            /<table class="detail-section-table">[\s\S]*?<thead>[\s\S]*?Mailbox &amp; Home Access[\s\S]*?<\/thead>/,
        );
        expect(result.html).toContain('thead { display: table-header-group; }');
        expect(result.html).toContain('.detail-row { break-inside: avoid;');
        expect(result.html).toContain('.provider-row { break-inside: avoid;');
        expect(result.html).toContain('.buyer-step { break-inside: avoid;');
        expect(result.html).not.toContain('packet-section keep-together');

        const detailTable = result.html.match(
            /<table class="detail-section-table">[\s\S]*?<\/table>/,
        )?.[0] || '';
        const detailRows = [...detailTable.matchAll(/<tr class="detail-row">[\s\S]*?<\/tr>/g)];
        const finalDetailRow = detailRows.at(-1)?.[0] || '';
        expect(finalDetailRow.match(/<td class="detail-cell">/g)).toHaveLength(1);
        expect(finalDetailRow.match(/<td class="detail-cell detail-cell-empty">/g)).toHaveLength(1);
    });

    it('keeps buyer steps atomic while allowing unusually long lists to paginate', () => {
        const result = buildPacketPdfHtml({
            mode: 'simple',
            request: {
                id: 'req_simple_steps',
                property_address: '112 Morris Place, Bushkill, PA 18324',
                created_at: '2026-07-06T12:00:00.000Z',
            },
            brand: null,
            utilities: [],
        });

        expect(result.html).toContain('.buyer-step { break-inside: avoid;');
        expect(result.html).toContain('class="buyer-steps-section"');
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
