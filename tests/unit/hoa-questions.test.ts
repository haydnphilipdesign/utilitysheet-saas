import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
    HOA_ANSWER_KEYS,
    HOA_GATE_LABEL,
    HOA_SECTION_TITLE,
    HOA_TEXT_FIELDS,
    collectsHoaQuestions,
    createEmptyHoaAnswers,
    formatHoaDues,
    getHoaDetailRows,
    normalizeHoaAnswers,
    resolveHoaSubmission,
} from '@/lib/packet/hoa';
import {
    getHomeBasicsRows,
    getIncludedSellerQuestionKeys,
    getSellerQuestionInventory,
    getSellerQuestionPreview,
    searchSellerQuestionSections,
} from '@/lib/packet/seller-questions';
import { buildPacketPdfHtml } from '@/lib/pdf/packet-html';
import { buildSubmittedSheetChangedFields } from '@/lib/submitted-sheet/editor';
import { sellerSubmissionBodySchema, submittedSheetUpdateBodySchema } from '@/lib/validation/schemas';
import type { HoaAnswers } from '@/types';

const FULL_ANSWERS: HoaAnswers = {
    has_hoa: 'yes',
    hoa_name: 'Lakeview Commons HOA',
    hoa_management_company: 'Crest Property Management',
    hoa_management_contact: 'Jordan Lee',
    hoa_management_phone: '(555) 204-8890',
    hoa_management_email: 'office@lakeview.example',
    hoa_dues_amount: '$240',
    hoa_dues_frequency: 'quarterly',
    hoa_portal_or_payment: 'Resident portal at portal.lakeview.example',
};

function packetHtml(mode: 'simple' | 'advanced', hoa: Partial<HoaAnswers>) {
    return buildPacketPdfHtml({
        mode,
        request: {
            id: `req_hoa_${mode}`,
            property_address: '112 Morris Place, Bushkill, PA 18324',
            created_at: '2026-07-06T12:00:00.000Z',
            water_source: 'city',
            sewer_type: 'public',
            heating_type: 'natural_gas',
            ...hoa,
        },
        brand: { name: 'Multimedium Team' },
        utilities: [{ category: 'electric', provider_name: 'PPL Electric' }],
        advanced_sections: mode === 'advanced'
            ? [{ key: 'access', title: 'Access Details', fields: [{ key: 'garage', label: 'Garage Code', value: '1234' }] }]
            : undefined,
    }).html;
}

describe('normalizeHoaAnswers', () => {
    it('keeps the details behind a Yes, trimmed', () => {
        expect(normalizeHoaAnswers({ ...FULL_ANSWERS, hoa_name: '  Lakeview Commons HOA  ' })).toEqual(FULL_ANSWERS);
    });

    it('drops every detail unless the answer is Yes', () => {
        for (const answer of ['no', 'not_sure', null] as const) {
            expect(normalizeHoaAnswers({ ...FULL_ANSWERS, has_hoa: answer })).toEqual({
                ...createEmptyHoaAnswers(),
                has_hoa: answer,
            });
        }
    });

    it('treats blank text and unknown choices as unanswered', () => {
        const answers = normalizeHoaAnswers({
            has_hoa: 'yes',
            hoa_name: '   ',
            hoa_dues_amount: 240,
            hoa_dues_frequency: 'weekly',
        });

        expect(answers.hoa_name).toBeNull();
        expect(answers.hoa_dues_amount).toBeNull();
        expect(answers.hoa_dues_frequency).toBeNull();
        expect(normalizeHoaAnswers({ has_hoa: 'maybe' }).has_hoa).toBeNull();
        // The water/sewer billing value is not a membership answer.
        expect(normalizeHoaAnswers({ has_hoa: 'hoa' }).has_hoa).toBeNull();
    });

    it('returns the empty shape for a row that predates the questions', () => {
        expect(normalizeHoaAnswers({})).toEqual(createEmptyHoaAnswers());
        expect(normalizeHoaAnswers(null)).toEqual(createEmptyHoaAnswers());
    });
});

describe('HOA packet rows', () => {
    it('prints every gate answer on Home Basics and omits it when never asked', () => {
        expect(getHomeBasicsRows({ has_hoa: 'yes' })).toEqual([{ label: HOA_GATE_LABEL, value: 'Yes' }]);
        expect(getHomeBasicsRows({ has_hoa: 'no' })).toEqual([{ label: HOA_GATE_LABEL, value: 'No' }]);
        expect(getHomeBasicsRows({ has_hoa: 'not_sure' })).toEqual([{ label: HOA_GATE_LABEL, value: 'Not Sure' }]);
        expect(getHomeBasicsRows({ has_hoa: null })).toEqual([]);
    });

    it('lists the filled-in details in asking order, with dues and period combined', () => {
        expect(getHoaDetailRows(FULL_ANSWERS).map((row) => [row.label, row.value])).toEqual([
            ['Association Name', 'Lakeview Commons HOA'],
            ['Management Company', 'Crest Property Management'],
            ['Contact Name', 'Jordan Lee'],
            ['Contact Phone', '(555) 204-8890'],
            ['Contact Email', 'office@lakeview.example'],
            ['Dues', '$240 per quarter'],
            ['Payments & Documents', 'Resident portal at portal.lakeview.example'],
        ]);
    });

    it('shows no details for a No, a Not Sure, or a Yes with nothing filled in', () => {
        expect(getHoaDetailRows({ ...FULL_ANSWERS, has_hoa: 'no' })).toEqual([]);
        expect(getHoaDetailRows({ ...FULL_ANSWERS, has_hoa: 'not_sure' })).toEqual([]);
        expect(getHoaDetailRows({ has_hoa: 'yes' })).toEqual([]);
    });

    it('formats dues from whichever parts the seller gave', () => {
        expect(formatHoaDues('$240', 'monthly')).toBe('$240 per month');
        expect(formatHoaDues('$1,200', 'yearly')).toBe('$1,200 per year');
        expect(formatHoaDues('$240', null)).toBe('$240');
        expect(formatHoaDues(null, 'quarterly')).toBe('Billed quarterly');
        expect(formatHoaDues('', null)).toBe('');
    });
});

describe('HOA answers in the packet PDF', () => {
    it('renders the gate answer and the detail section in both packet modes', () => {
        for (const mode of ['simple', 'advanced'] as const) {
            const html = packetHtml(mode, FULL_ANSWERS);

            expect(html).toContain(HOA_GATE_LABEL);
            expect(html).toContain(HOA_SECTION_TITLE);
            for (const row of getHoaDetailRows(FULL_ANSWERS)) {
                expect(html).toContain(row.label.replace('&', '&amp;'));
                expect(html).toContain(row.value);
            }
        }
    });

    it('never prints a raw stored value', () => {
        const html = packetHtml('simple', { ...FULL_ANSWERS, has_hoa: 'not_sure' });

        expect(html).toContain('Not Sure');
        expect(html).not.toMatch(/>\s*not_sure\s*</);
        expect(packetHtml('simple', FULL_ANSWERS)).not.toMatch(/>\s*quarterly\s*</);
    });

    it('omits the detail section unless the seller answered Yes', () => {
        expect(packetHtml('simple', { ...FULL_ANSWERS, has_hoa: 'no' })).not.toContain(HOA_SECTION_TITLE);
        expect(packetHtml('simple', { ...FULL_ANSWERS, has_hoa: 'no' })).not.toContain('Lakeview Commons HOA');
        expect(packetHtml('simple', {})).not.toContain(HOA_GATE_LABEL);
    });

    it('escapes seller-entered association text', () => {
        const html = packetHtml('simple', { has_hoa: 'yes', hoa_name: '<script>alert(1)</script>' });

        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('does not restyle the capitalization of a Home Basics or association value', () => {
        // `text-transform: capitalize` turned "Included in HOA" into "Included In
        // HOA" and would do the same to an email address.
        const html = packetHtml('simple', FULL_ANSWERS);
        const homeBasicValueRule = html.match(/\.home-basic-value \{[^}]*\}/)?.[0] || '';

        expect(homeBasicValueRule).not.toContain('capitalize');
    });
});

describe('HOA questions in the seller question inventory', () => {
    const homeBasics = getSellerQuestionInventory().find((section) => section.key === 'home_basics');
    const byKey = (key: string) => homeBasics?.questions.find((question) => question.key === key);

    it('lists the gate and every detail question under Home Basics', () => {
        expect(byKey('home_basics.has_hoa')?.choices).toEqual(['Yes', 'No', 'Not Sure']);
        expect(byKey('home_basics.has_hoa')?.condition).toContain('on for this request');
        for (const field of HOA_TEXT_FIELDS) {
            expect(byKey(`home_basics.${field.key}`)?.condition).toContain('answers Yes');
        }
        expect(byKey('home_basics.hoa_dues_frequency')?.choices).toEqual(['Monthly', 'Quarterly', 'Yearly']);
    });

    it('includes them on the Free-plan Simple sheet, not only in handoff mode', () => {
        const simple = getSellerQuestionPreview({
            packetMode: 'simple',
            utilityCategories: ['electric'],
            advancedModules: [],
        }).find((section) => section.key === 'home_basics');

        expect(simple?.questions.some((question) => question.key === 'home_basics.has_hoa')).toBe(true);
        expect(simple?.handoffOnly).toBe(false);
    });

    it('is findable by searching for HOA', () => {
        const results = searchSellerQuestionSections(getSellerQuestionInventory(), 'hoa');

        expect(results.flatMap((section) => section.questions).map((question) => question.key)).toContain(
            'home_basics.has_hoa'
        );
    });

    it('warns against passwords and account numbers on the free-text portal question', () => {
        const helper = byKey('home_basics.hoa_portal_or_payment')?.helper || '';

        expect(helper).toMatch(/password/i);
        expect(helper).toMatch(/account number/i);
    });
});

describe('turning the HOA questions off in Settings', () => {
    const config = { packetMode: 'simple' as const, utilityCategories: ['electric' as const], advancedModules: [] };
    const hoaKeys = (keys: Iterable<string>) => [...keys].filter((key) => /^home_basics\.(has_hoa|hoa_)/.test(key));

    it('is on unless the account preference is explicitly false', () => {
        expect(collectsHoaQuestions(undefined)).toBe(true);
        expect(collectsHoaQuestions(null)).toBe(true);
        expect(collectsHoaQuestions({})).toBe(true);
        expect(collectsHoaQuestions({ collect_electric_meter_number: false })).toBe(true);
        expect(collectsHoaQuestions({ collect_hoa_questions: true })).toBe(true);
        expect(collectsHoaQuestions({ collect_hoa_questions: false })).toBe(false);
    });

    it('removes all nine HOA questions from the seller preview, and nothing else', () => {
        const on = getSellerQuestionPreview(config);
        const off = getSellerQuestionPreview({ ...config, collectHoaQuestions: false });
        const keys = (sections: typeof on) => sections.flatMap((section) => section.questions.map((question) => question.key));

        expect(hoaKeys(keys(on))).toHaveLength(9);
        expect(hoaKeys(keys(off))).toHaveLength(0);
        expect(keys(off)).toEqual(keys(on).filter((key) => hoaKeys([key]).length === 0));
        expect(keys(getSellerQuestionPreview({ ...config, collectHoaQuestions: true }))).toEqual(keys(on));
    });

    it('keeps them in the full inventory, marked as not included', () => {
        const inventoryKeys = getSellerQuestionInventory().flatMap((section) => section.questions.map((question) => question.key));

        expect(hoaKeys(inventoryKeys)).toHaveLength(9);
        expect(hoaKeys(getIncludedSellerQuestionKeys(config))).toHaveLength(9);
        expect(hoaKeys(getIncludedSellerQuestionKeys({ ...config, collectHoaQuestions: false }))).toHaveLength(0);
    });

    it('writes nothing from a submission while the questions are off', () => {
        // A form opened before the switch was flipped can still send answers.
        expect(resolveHoaSubmission(FULL_ANSWERS, false)).toEqual({ update: false, answers: createEmptyHoaAnswers() });
        expect(resolveHoaSubmission(FULL_ANSWERS, true)).toEqual({ update: true, answers: FULL_ANSWERS });
    });

    it('still leaves stored answers alone for a form that predates the questions', () => {
        expect(resolveHoaSubmission({}, true).update).toBe(false);
        expect(resolveHoaSubmission({ has_hoa: null }, true)).toEqual({ update: true, answers: createEmptyHoaAnswers() });
    });
});

describe('HOA answers in request validation', () => {
    const sellerBody = {
        water_source: 'not_sure',
        sewer_type: 'not_sure',
        heating_type: 'not_sure',
        fuels_present: [] as string[],
        primary_heating_type: null as string | null,
        trash_handled_by: 'not_sure' as const,
        utilities: {},
    };

    it('accepts a seller submission from a form loaded before the questions existed', () => {
        const parsed = sellerSubmissionBodySchema.safeParse(sellerBody);

        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        // Absent, not null: the route leaves the stored answers alone.
        expect(parsed.data.has_hoa).toBeUndefined();
    });

    it('accepts the full set of answers and an unanswered gate', () => {
        const full = sellerSubmissionBodySchema.safeParse({ ...sellerBody, ...FULL_ANSWERS });
        const unanswered = sellerSubmissionBodySchema.safeParse({ ...sellerBody, ...createEmptyHoaAnswers() });

        expect(full.success).toBe(true);
        expect(unanswered.success).toBe(true);
        if (!full.success || !unanswered.success) return;
        expect(normalizeHoaAnswers(full.data)).toEqual(FULL_ANSWERS);
        expect(unanswered.data.has_hoa).toBeNull();
    });

    it('rejects an unknown gate answer and over-length text', () => {
        expect(sellerSubmissionBodySchema.safeParse({ ...sellerBody, has_hoa: 'maybe' }).success).toBe(false);
        for (const field of HOA_TEXT_FIELDS) {
            const tooLong = 'x'.repeat(field.maxLength + 1);
            const atLimit = 'x'.repeat(field.maxLength);

            expect(sellerSubmissionBodySchema.safeParse({ ...sellerBody, has_hoa: 'yes', [field.key]: tooLong }).success).toBe(false);
            expect(sellerSubmissionBodySchema.safeParse({ ...sellerBody, has_hoa: 'yes', [field.key]: atLimit }).success).toBe(true);
        }
    });

    it('lets the submitted-sheet editor send HOA answers, and omit them from an older tab', () => {
        const editorBody = {
            updatedAt: '2026-10-01T12:00:00.000Z',
            propertyAddress: '112 Morris Place, Bushkill, PA 18324',
            utilities: {},
        };

        const withHoa = submittedSheetUpdateBodySchema.safeParse({ ...editorBody, hoa: FULL_ANSWERS });
        const withoutHoa = submittedSheetUpdateBodySchema.safeParse(editorBody);

        expect(withHoa.success).toBe(true);
        expect(withoutHoa.success).toBe(true);
        if (!withHoa.success || !withoutHoa.success) return;
        expect(normalizeHoaAnswers(withHoa.data.hoa)).toEqual(FULL_ANSWERS);
        expect(withoutHoa.data.hoa).toBeUndefined();
        expect(submittedSheetUpdateBodySchema.safeParse({ ...editorBody, hoa: { hoa_password: 'x' } }).success).toBe(false);
    });
});

describe('HOA answers in submitted-sheet change tracking', () => {
    const unchanged = {
        existingPropertyAddress: '112 Morris Place',
        nextPropertyAddress: '112 Morris Place',
        existingUtilities: {},
        nextUtilities: {},
        existingAdvanced: {},
        nextAdvanced: {},
        enabledModules: [],
        exclusions: {},
    };

    it('reports a change to any answer as one `hoa` field', () => {
        expect(buildSubmittedSheetChangedFields({
            ...unchanged,
            existingHoa: FULL_ANSWERS,
            nextHoa: { ...FULL_ANSWERS, hoa_dues_frequency: 'monthly' },
        })).toEqual(['hoa']);
        expect(buildSubmittedSheetChangedFields({
            ...unchanged,
            existingHoa: createEmptyHoaAnswers(),
            nextHoa: { ...createEmptyHoaAnswers(), has_hoa: 'no' },
        })).toEqual(['hoa']);
    });

    it('reports nothing when the answers match or the editor sent none', () => {
        expect(buildSubmittedSheetChangedFields({ ...unchanged, existingHoa: FULL_ANSWERS, nextHoa: { ...FULL_ANSWERS } })).toEqual([]);
        expect(buildSubmittedSheetChangedFields({ ...unchanged, existingHoa: FULL_ANSWERS })).toEqual([]);
    });
});

describe('HOA columns', () => {
    it.each(['migrations-hoa-questions.sql', 'schema.sql'])('%s declares every stored answer', async (filePath) => {
        const sql = await readFile(filePath, 'utf8');

        for (const key of HOA_ANSWER_KEYS) {
            expect(sql).toMatch(new RegExp(`\\b${key} TEXT\\b`));
        }
        expect(sql).toContain("CHECK (has_hoa IN ('yes', 'no', 'not_sure'))");
        expect(sql).toContain("CHECK (hoa_dues_frequency IN ('monthly', 'quarterly', 'yearly'))");
    });
});
