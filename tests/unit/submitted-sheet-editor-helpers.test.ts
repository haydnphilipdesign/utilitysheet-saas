import { describe, expect, it } from 'vitest';
import {
    buildSubmittedSheetChangedFields,
    buildSubmittedSheetUtilities,
    buildSubmittedSheetUtilityInsertRows,
    inferSubmittedSheetUtilityStatus,
} from '@/lib/submitted-sheet/editor';
import type { SubmittedSheetEditableUtilities, UtilityEntry } from '@/types';

function entry(fields: Partial<UtilityEntry> & Pick<UtilityEntry, 'category'>): UtilityEntry {
    return {
        id: `entry_${fields.category}`,
        request_id: 'req_1',
        entry_mode: 'free_text',
        display_name: null,
        raw_text: null,
        meter_number: null,
        canonical_id: null,
        confidence_score: null,
        contact_phone: null,
        contact_url: null,
        extra: {},
        created_at: '',
        updated_at: '',
        ...fields,
    };
}

const sellerRows: UtilityEntry[] = [
    entry({ category: 'electric', entry_mode: 'suggested_confirmed', display_name: 'Duke Energy', raw_text: 'Duke Energy' }),
    entry({ category: 'gas', entry_mode: 'unknown' }),
    entry({
        category: 'trash',
        entry_mode: 'unknown',
        extra: { has_recycling: 'yes', trash_pickup_days: ['tue'], trash_pickup_day: 'tue' },
    }),
];

describe('submitted sheet utility statuses', () => {
    it('distinguishes a named provider, a seller "Not sure" answer, and a requested utility with no answer', () => {
        const utilities = buildSubmittedSheetUtilities(['electric', 'gas', 'trash', 'internet'], sellerRows);

        expect(utilities.electric?.status).toBe('provider');
        expect(utilities.gas?.status).toBe('not_sure');
        expect(utilities.trash?.status).toBe('not_sure');
        expect(utilities.trash?.trashDetails.trashPickupDays).toEqual(['tue']);
        expect(utilities.internet?.status).toBe('not_included');
    });

    it('keeps "Not sure" rows, including ones without any other details, when saving unchanged utilities', () => {
        const utilities = buildSubmittedSheetUtilities(['electric', 'gas', 'trash', 'internet'], sellerRows);
        const rows = buildSubmittedSheetUtilityInsertRows(utilities);

        expect(rows.map((row) => [row.category, row.entry_mode, row.display_name])).toEqual([
            ['electric', 'free_text', 'Duke Energy'],
            ['gas', 'unknown', null],
            ['trash', 'unknown', null],
        ]);
        expect(rows.find((row) => row.category === 'trash')?.extra).toMatchObject({ trash_pickup_days: ['tue'] });
    });

    it('replaces "Not sure" with a provider, or removes the utility, without losing trash details', () => {
        const utilities = buildSubmittedSheetUtilities(['gas', 'trash'], sellerRows);
        const edited: SubmittedSheetEditableUtilities = {
            gas: { ...utilities.gas!, status: 'not_included' },
            trash: { ...utilities.trash!, status: 'provider', providerName: 'Republic Services' },
        };

        const rows = buildSubmittedSheetUtilityInsertRows(edited);

        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            category: 'trash',
            entry_mode: 'free_text',
            display_name: 'Republic Services',
            extra: { has_recycling: 'yes', trash_pickup_days: ['tue'] },
        });
    });

    it('ignores a leftover provider name when the utility is marked "Not sure"', () => {
        const [row] = buildSubmittedSheetUtilityInsertRows({
            gas: { ...buildSubmittedSheetUtilities(['gas'], sellerRows).gas!, providerName: 'Typed then abandoned' },
        });
        expect(row).toMatchObject({ entry_mode: 'unknown', display_name: null, raw_text: null });
    });

    it('infers the legacy meaning for payloads without a status', () => {
        const blank = { providerName: '', contactPhone: '', contactUrl: '', meterNumber: '', trashDetails: { hasRecycling: '' as const, trashPickupDay: '' as const, trashPickupDays: [], recyclingPickupDay: '' as const, recyclingPickupDays: [] } };
        expect(inferSubmittedSheetUtilityStatus({ ...blank, providerName: 'Named' })).toBe('provider');
        expect(inferSubmittedSheetUtilityStatus({ ...blank, meterNumber: '123' })).toBe('not_sure');
        expect(inferSubmittedSheetUtilityStatus(blank)).toBe('not_included');
    });

    it('reports status and home basics changes', () => {
        const existing = buildSubmittedSheetUtilities(['gas', 'trash'], sellerRows);
        const changed = buildSubmittedSheetChangedFields({
            existingPropertyAddress: '1 Main St',
            nextPropertyAddress: '1 Main St',
            existingHomeBasics: { waterSource: 'city', sewerType: 'public', heatingType: 'not_sure' },
            nextHomeBasics: { waterSource: 'city', sewerType: 'public', heatingType: null },
            existingUtilities: existing,
            nextUtilities: { ...existing, gas: { ...existing.gas!, status: 'not_included' } },
            existingAdvanced: {},
            nextAdvanced: {},
            enabledModules: [],
            exclusions: {},
        });

        expect(changed).toEqual(['heating_type', 'utility_gas']);
    });

    it('does not report a change when only a hidden value differs for a utility left off the sheet', () => {
        const existing = buildSubmittedSheetUtilities(['internet'], []);
        const changed = buildSubmittedSheetChangedFields({
            existingPropertyAddress: '1 Main St',
            nextPropertyAddress: '1 Main St',
            existingUtilities: existing,
            nextUtilities: { internet: { ...existing.internet!, providerName: 'Draft text' } },
            existingAdvanced: {},
            nextAdvanced: {},
            enabledModules: [],
            exclusions: {},
        });

        expect(changed).toEqual([]);
    });
});
