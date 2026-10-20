import { describe, expect, it } from 'vitest';

import { UTILITY_CATEGORIES } from '@/lib/constants';
import { buildUtilitySheetTemplatePdf } from '@/lib/templates/utility-sheet-template';

describe('printable utility sheet template', () => {
    const pdf = Buffer.from(buildUtilitySheetTemplatePdf()).toString('latin1');

    it('is a one-page US Letter PDF', () => {
        expect(pdf.startsWith('%PDF-')).toBe(true);
        expect(pdf.match(/\/Type \/Page\b/g)).toHaveLength(1);
        expect(pdf).toMatch(/\/MediaBox \[0 0 612\.?0* 792\.?0*\]/);
    });

    it('lists every utility the product collects, as selectable text', () => {
        for (const category of UTILITY_CATEGORIES) {
            expect(pdf).toContain(`(${category.label})`);
        }
        expect(pdf).toContain('(Utility Info Sheet)');
    });

    it('warns against private account details', () => {
        expect(pdf).toContain('Never write account numbers, passwords, or PINs on this sheet.');
    });
});
