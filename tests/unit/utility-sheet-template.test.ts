import { describe, expect, it } from 'vitest';

import { GET } from '@/app/templates/[file]/route';
import { UTILITY_CATEGORIES } from '@/lib/constants';
import { sampleUtilitySheet } from '@/lib/templates/sample-utility-sheet';
import {
    buildUtilitySheetSamplePdf,
    buildUtilitySheetTemplatePdf,
    sampleFieldValues,
} from '@/lib/templates/utility-sheet-template';

const asText = (pdf: ArrayBuffer) => Buffer.from(pdf).toString('latin1');

/** Field objects in the order the page lists them, which is the tab order. */
function formFields(pdf: string) {
    const objects = new Map<string, string>();
    for (const match of pdf.matchAll(/^(\d+) 0 obj\r?\n([\s\S]*?)^endobj/gm)) {
        objects.set(match[1], match[2]);
    }
    const annots = pdf.match(/\/Annots \[([^\]]*)\]/)?.[1] ?? '';
    return [...annots.matchAll(/(\d+) 0 R/g)].map(([, id]) => {
        const body = objects.get(id) ?? '';
        return {
            body,
            name: body.match(/\/T \(([^)]*)\)/)?.[1],
            type: body.match(/\/FT \/(\w+)/)?.[1],
        };
    });
}

describe('fillable utility sheet template', () => {
    const pdf = asText(buildUtilitySheetTemplatePdf());
    const fields = formFields(pdf);

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

    it('has a field on every line, tabbing top to bottom and across each table row', () => {
        const names = fields.map((field) => field.name);
        expect(names.slice(0, 5)).toEqual([
            'property_address',
            'seller_name',
            'seller_phone',
            'date_completed',
            'water_source_city_public',
        ]);
        const tableStart = names.indexOf('electric_provider');
        expect(names.slice(tableStart, tableStart + UTILITY_CATEGORIES.length * 3)).toEqual(
            UTILITY_CATEGORIES.flatMap(({ key }) => [`${key}_provider`, `${key}_phone`, `${key}_notes`]),
        );
        expect(names.at(-1)).toBe('hoa_payment_documents');
        expect(new Set(names).size).toBe(names.length);
        expect(fields.filter((field) => field.type === 'Tx')).toHaveLength(38);
        expect(fields.filter((field) => field.type === 'Btn')).toHaveLength(16);
    });

    it('gives viewers what they need to fill it in', () => {
        // Form fonts come from the page's own resource dictionary.
        expect(pdf).toMatch(/\/Resources 2 0 R/);
        expect(pdf).toMatch(/\/AcroForm \d+ 0 R/);
        expect(pdf).toMatch(/\/DR 2 0 R\r?\n\/DA \(\/F1 0 Tf 0 g\)/);
        for (const field of fields) {
            expect(field.body, field.name).toMatch(/\/TU \([^)]+\)/);
            expect(field.body, field.name).toMatch(/\/F 4\b/);
            if (field.type === 'Tx') {
                expect(field.body, field.name).toMatch(/\/DA \(\/F1 (0|9) Tf /);
            } else {
                expect(field.body, field.name).toMatch(/\/V \/Off/);
                expect(field.body, field.name).toMatch(/\/AS \/Off/);
                expect(field.body, field.name).toMatch(/\/N <<\/On \d+ 0 R \/Off \d+ 0 R >>/);
            }
        }
    });
});

describe('sample utility sheet', () => {
    const pdf = asText(buildUtilitySheetSamplePdf());

    it('is a flat one-page PDF labeled as a sample', () => {
        expect(pdf.match(/\/Type \/Page\b/g)).toHaveLength(1);
        expect(pdf).not.toContain('/AcroForm');
        expect(pdf).toContain('(SAMPLE)');
        expect(pdf).toContain('Sample with fictional details. Not a real property, seller, or provider.');
        expect(pdf).toContain('(Utility Info Sheet \\(sample with fictional details\\))');
    });

    it('fills in real template fields', () => {
        const fieldNames = new Set(formFields(asText(buildUtilitySheetTemplatePdf())).map((field) => field.name));
        const { text, checked } = sampleFieldValues();
        for (const name of [...Object.keys(text), ...checked]) {
            expect(fieldNames, name).toContain(name);
        }
        expect(checked).toHaveLength(4);
        for (const value of Object.values(text)) {
            expect(pdf).toContain(value.replace(/[\\()]/g, (match) => `\\${match}`));
        }
    });

    it('uses only obviously fictional contact details', () => {
        const values = Object.values(sampleFieldValues().text);
        const phones = values.filter((value) => /\d{3}-\d{4}/.test(value));
        expect(phones.length).toBeGreaterThan(5);
        for (const phone of phones) {
            expect(phone).toMatch(/^\(555\) 555-01\d\d$/);
        }
        const webAddresses = values.flatMap((value) => value.match(/[\w.-]+\.[a-z]{2,}\b/gi) ?? []);
        expect(webAddresses.length).toBeGreaterThan(0);
        for (const address of webAddresses) {
            expect(address).toMatch(/(\.example|example\.com)$/);
        }
        expect(sampleUtilitySheet.propertyAddress).toBe('123 Sample Street, Anytown');
    });
});

describe('template download route', () => {
    const get = (file: string) => GET(new Request(`http://localhost/templates/${file}`), { params: Promise.resolve({ file }) });

    it('serves the template and the sample, and nothing else', async () => {
        const template = await get('utility-info-sheet.pdf');
        expect(template.status).toBe(200);
        expect(template.headers.get('Content-Disposition')).toContain('utility-info-sheet-template.pdf');
        expect(asText(await template.arrayBuffer())).toContain('/AcroForm');

        const sample = await get('utility-info-sheet-sample.pdf');
        expect(sample.status).toBe(200);
        expect(sample.headers.get('Content-Disposition')).toContain('utility-info-sheet-sample.pdf');
        expect(asText(await sample.arrayBuffer())).toContain('(SAMPLE)');

        expect((await get('other.pdf')).status).toBe(404);
        expect((await get('toString')).status).toBe(404);
    });
});
