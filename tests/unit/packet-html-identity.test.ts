import { describe, expect, it } from 'vitest';
import { buildPacketPdfHtml, type PacketPdfData } from '@/lib/pdf/packet-html';

function build(brand: NonNullable<PacketPdfData['brand']>): string {
    return buildPacketPdfHtml({
        mode: 'simple',
        request: {
            id: 'req_identity',
            property_address: '112 Morris Place, Bushkill, PA 18324',
            created_at: '2026-07-06T12:00:00.000Z',
        },
        brand,
        utilities: [{ category: 'water', provider_name: 'Town Water' }],
    }).html;
}

describe('buildPacketPdfHtml structured professional identity', () => {
    it('renders company, role, license, and compliance line when present', () => {
        const html = build({
            name: 'Acme Realty',
            contact_name: 'Jane Smith',
            professional_title: 'REALTOR',
            company_name: 'Acme Realty Group',
            license_number: '01234567',
            license_state: 'TX',
            compliance_line: 'Brokered by Acme Realty',
        });

        expect(html).toContain('Jane Smith · REALTOR');
        expect(html).toContain('Acme Realty Group');
        expect(html).toContain('License #01234567 · TX');
        expect(html).toContain('class="compliance-line keep-together"');
        expect(html).toContain('Brokered by Acme Realty');
    });

    it('omits identity markup entirely when the fields are absent (no blank lines)', () => {
        const html = build({ name: 'Acme Realty', contact_name: 'Jane Smith' });

        expect(html).not.toContain('License #');
        // The CSS always defines .compliance-line; assert the element isn't rendered.
        expect(html).not.toContain('class="compliance-line');
        // The name line has no trailing separator when there is no title.
        expect(html).toContain('>Jane Smith</p>');
    });

    it('formats a license with only a state', () => {
        const html = build({ name: 'Acme', license_state: 'CA' });
        expect(html).toContain('Licensed in CA');
    });

    it('escapes HTML in identity fields', () => {
        const html = build({
            name: 'Acme',
            company_name: '<script>alert(1)</script>',
            compliance_line: 'A & B <b>',
        });
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('&lt;script&gt;');
        expect(html).toContain('A &amp; B &lt;b&gt;');
    });
});
