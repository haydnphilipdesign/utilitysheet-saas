import { FUEL_UTILITY_CATEGORY_BY_FUEL, OPTIONAL_UTILITY_CATEGORIES } from '@/lib/packet/seller-questions';
import type { UtilityCategory } from '@/types';

/*
 * Stored sheet -> seller form, used when a coordinator reopens a submitted
 * request. The seller starts from what is on the sheet now, including any
 * coordinator corrections, instead of from a blank form or an old local draft.
 *
 * Kept free of server and React imports so the seller route builds the payload
 * and the wizard applies it from the same definitions.
 */

export interface SellerPrefillUtility {
    category: UtilityCategory;
    entry_mode: 'suggested_confirmed' | 'search_selected' | 'free_text' | 'unknown';
    display_name: string | null;
    raw_text: string | null;
    meter_number: string | null;
    canonical_id: string | null;
    confidence_score: number | null;
    contact_phone: string | null;
    contact_url: string | null;
    extra: Record<string, unknown>;
}

export interface SellerPrefill {
    water_source: string | null;
    sewer_type: string | null;
    heating_type: string | null;
    utilities: SellerPrefillUtility[];
}

const ENTRY_MODES = new Set(['suggested_confirmed', 'search_selected', 'free_text', 'unknown']);
const WATER_SOURCES = new Set(['city', 'well', 'hoa', 'not_sure']);
const SEWER_TYPES = new Set(['public', 'septic', 'hoa', 'not_sure']);
const FUELS = new Set(['natural_gas', 'propane', 'oil', 'electric']);

type StoredEntry = {
    category?: unknown;
    entry_mode?: unknown;
    display_name?: unknown;
    raw_text?: unknown;
    meter_number?: unknown;
    canonical_id?: unknown;
    confidence_score?: unknown;
    contact_phone?: unknown;
    contact_url?: unknown;
    extra?: unknown;
};

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);

export function buildSellerPrefill(
    request: { water_source?: string | null; sewer_type?: string | null; heating_type?: string | null },
    entries: StoredEntry[],
    options: { requestedCategories: string[]; collectElectricMeterNumber: boolean }
): SellerPrefill {
    const requested = new Set(options.requestedCategories);
    const seen = new Set<string>();
    const utilities: SellerPrefillUtility[] = [];

    for (const entry of entries) {
        const category = typeof entry.category === 'string' ? entry.category : '';
        if (!requested.has(category) || seen.has(category)) continue;
        seen.add(category);

        const mode = typeof entry.entry_mode === 'string' && ENTRY_MODES.has(entry.entry_mode) ? entry.entry_mode : 'unknown';
        const score = Number(entry.confidence_score);
        utilities.push({
            category: category as UtilityCategory,
            entry_mode: mode as SellerPrefillUtility['entry_mode'],
            display_name: text(entry.display_name),
            raw_text: text(entry.raw_text),
            meter_number: category === 'electric' && options.collectElectricMeterNumber ? text(entry.meter_number) : null,
            canonical_id: text(entry.canonical_id),
            confidence_score: entry.confidence_score !== null && entry.confidence_score !== undefined && Number.isFinite(score) ? score : null,
            contact_phone: text(entry.contact_phone),
            contact_url: text(entry.contact_url),
            extra: entry.extra && typeof entry.extra === 'object' && !Array.isArray(entry.extra)
                ? (entry.extra as Record<string, unknown>)
                : {},
        });
    }

    return {
        water_source: request.water_source || null,
        sewer_type: request.sewer_type || null,
        heating_type: request.heating_type || null,
        utilities,
    };
}

export interface SellerPrefillState {
    /** Null when the sheet holds no usable value; the seller is asked again. */
    water_source: 'city' | 'well' | 'hoa' | 'not_sure' | null;
    sewer_type: 'public' | 'septic' | 'hoa' | 'not_sure' | null;
    fuels_present: string[];
    primary_heating_type: string | null;
    optional_utilities: UtilityCategory[];
    utilities: Partial<Record<UtilityCategory, Omit<SellerPrefillUtility, 'category'> & { hidden: boolean }>>;
}

/**
 * The Home Basics and provider answers the wizard starts from.
 *
 * The sheet stores one heating type, not the list of fuels the seller ticked,
 * so the list is rebuilt from the fuel providers on the sheet plus the heating
 * type. Optional utilities are the ones that have a row. A sheet with no trash
 * row carries no trash answer: "no trash service" is not stored, so it cannot
 * be told apart from never having been asked, and the wizard asks.
 */
export function sellerPrefillToWizardState(prefill: SellerPrefill): SellerPrefillState {
    const categories = new Set(prefill.utilities.map((utility) => utility.category));

    const fuels = Object.entries(FUEL_UTILITY_CATEGORY_BY_FUEL)
        .filter(([, category]) => categories.has(category))
        .map(([fuel]) => fuel);
    const heatingType = prefill.heating_type && FUELS.has(prefill.heating_type) ? prefill.heating_type : null;
    if (heatingType && !fuels.includes(heatingType)) fuels.push(heatingType);

    return {
        water_source: (prefill.water_source && WATER_SOURCES.has(prefill.water_source)
            ? prefill.water_source
            : null) as SellerPrefillState['water_source'],
        sewer_type: (prefill.sewer_type && SEWER_TYPES.has(prefill.sewer_type)
            ? prefill.sewer_type
            : null) as SellerPrefillState['sewer_type'],
        fuels_present: fuels,
        primary_heating_type: heatingType ?? (fuels.length === 1 ? fuels[0] : null),
        optional_utilities: OPTIONAL_UTILITY_CATEGORIES.filter((category) => categories.has(category)),
        utilities: Object.fromEntries(
            prefill.utilities.map(({ category, ...utility }) => [category, { ...utility, hidden: false }])
        ),
    };
}
