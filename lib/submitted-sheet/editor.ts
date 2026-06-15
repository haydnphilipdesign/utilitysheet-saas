import { UTILITY_CATEGORY_KEYS } from '@/lib/constants';
import { getAdvancedModuleVisibleFieldKeys } from '@/lib/packet/modules';
import type {
    AdvancedModuleExclusions,
    AdvancedModuleKey,
    AdvancedPacketData,
    SubmittedSheetEditableTrashDetails,
    SubmittedSheetEditableUtilities,
    SubmittedSheetEditableUtility,
    TrashPickupDay,
    UtilityCategory,
    UtilityEntry,
} from '@/types';

const EMPTY_TRASH_DETAILS: SubmittedSheetEditableTrashDetails = {
    hasRecycling: '',
    trashPickupDay: '',
    trashPickupDays: [],
    recyclingPickupDay: '',
};

export function createEmptySubmittedSheetUtility(): SubmittedSheetEditableUtility {
    return {
        providerName: '',
        contactPhone: '',
        contactUrl: '',
        meterNumber: '',
        trashDetails: { ...EMPTY_TRASH_DETAILS },
    };
}

function normalizeUnknownRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
}

function normalizeTrashPickupDay(value: unknown): '' | TrashPickupDay {
    if (typeof value !== 'string') return '';
    const normalized = value.trim().toLowerCase();
    const allowed: TrashPickupDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'varies', 'not_sure'];
    return allowed.includes(normalized as TrashPickupDay) ? normalized as TrashPickupDay : '';
}

function normalizeTrashPickupDays(value: unknown): TrashPickupDay[] {
    if (!Array.isArray(value)) return [];

    const days: TrashPickupDay[] = [];
    for (const item of value) {
        const normalized = normalizeTrashPickupDay(item);
        if (normalized && !days.includes(normalized)) {
            days.push(normalized);
        }
    }
    return days;
}

function normalizeTrashDetails(value: unknown): SubmittedSheetEditableTrashDetails {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { ...EMPTY_TRASH_DETAILS };
    }

    const input = value as Record<string, unknown>;
    const hasRecycling = typeof input.has_recycling === 'string'
        ? input.has_recycling.trim().toLowerCase()
        : '';

    const trashPickupDays = normalizeTrashPickupDays(input.trash_pickup_days);
    const legacyTrashPickupDay = normalizeTrashPickupDay(input.trash_pickup_day);

    return {
        hasRecycling: hasRecycling === 'yes' || hasRecycling === 'no' || hasRecycling === 'not_sure'
            ? hasRecycling
            : '',
        trashPickupDay: trashPickupDays[0] || legacyTrashPickupDay,
        trashPickupDays: trashPickupDays.length > 0
            ? trashPickupDays
            : legacyTrashPickupDay
                ? [legacyTrashPickupDay]
                : [],
        recyclingPickupDay: normalizeTrashPickupDay(input.recycling_pickup_day),
    };
}

function getOrderedUtilityCategories(
    requestUtilityCategories: UtilityCategory[] | null | undefined,
    utilityEntries: UtilityEntry[]
): UtilityCategory[] {
    const requested = new Set<UtilityCategory>(requestUtilityCategories || []);
    const existing = new Set<UtilityCategory>(utilityEntries.map((entry) => entry.category));
    const included = new Set<UtilityCategory>([...requested, ...existing]);

    return UTILITY_CATEGORY_KEYS.filter((category) => included.has(category));
}

export function buildSubmittedSheetUtilities(
    requestUtilityCategories: UtilityCategory[] | null | undefined,
    utilityEntries: UtilityEntry[]
): SubmittedSheetEditableUtilities {
    const categories = getOrderedUtilityCategories(requestUtilityCategories, utilityEntries);
    const utilities: SubmittedSheetEditableUtilities = {};

    for (const category of categories) {
        const existing = utilityEntries.find((entry) => entry.category === category);
        utilities[category] = {
            providerName: existing?.display_name || existing?.raw_text || '',
            contactPhone: existing?.contact_phone || '',
            contactUrl: existing?.contact_url || '',
            meterNumber: existing?.meter_number || '',
            trashDetails: category === 'trash'
                ? normalizeTrashDetails(existing?.extra)
                : { ...EMPTY_TRASH_DETAILS },
        };
    }

    return utilities;
}

function normalizeUtilityForComparison(value: SubmittedSheetEditableUtility | undefined) {
    if (!value) return null;
    return {
        providerName: value.providerName.trim(),
        contactPhone: value.contactPhone.trim(),
        contactUrl: value.contactUrl.trim(),
        meterNumber: value.meterNumber.trim(),
        trashDetails: {
            hasRecycling: value.trashDetails.hasRecycling,
            trashPickupDay: value.trashDetails.trashPickupDay,
            trashPickupDays: [...value.trashDetails.trashPickupDays],
            recyclingPickupDay: value.trashDetails.hasRecycling === 'no' ? '' : value.trashDetails.recyclingPickupDay,
        },
    };
}

function normalizeAdvancedSectionForComparison(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const section = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};

    for (const [fieldKey, rawValue] of Object.entries(section)) {
        if (Array.isArray(rawValue)) {
            normalized[fieldKey] = rawValue.map((item) => String(item)).sort();
            continue;
        }
        if (typeof rawValue === 'string') {
            normalized[fieldKey] = rawValue.trim();
            continue;
        }
        normalized[fieldKey] = rawValue ?? null;
    }

    return normalized;
}

export function buildSubmittedSheetChangedFields(params: {
    existingPropertyAddress: string;
    nextPropertyAddress: string;
    existingUtilities: SubmittedSheetEditableUtilities;
    nextUtilities: SubmittedSheetEditableUtilities;
    existingAdvanced: AdvancedPacketData;
    nextAdvanced: AdvancedPacketData;
    enabledModules: AdvancedModuleKey[];
    exclusions: AdvancedModuleExclusions;
}): string[] {
    const changed = new Set<string>();

    if (params.existingPropertyAddress.trim() !== params.nextPropertyAddress.trim()) {
        changed.add('property_address');
    }

    for (const category of UTILITY_CATEGORY_KEYS) {
        const before = normalizeUtilityForComparison(params.existingUtilities[category]);
        const after = normalizeUtilityForComparison(params.nextUtilities[category]);
        if (JSON.stringify(before) !== JSON.stringify(after)) {
            changed.add(`utility_${category}`);
        }
    }

    for (const moduleKey of params.enabledModules) {
        const visibleKeys = getAdvancedModuleVisibleFieldKeys(moduleKey, params.exclusions);
        const before = normalizeAdvancedSectionForComparison(params.existingAdvanced?.[moduleKey]);
        const after = normalizeAdvancedSectionForComparison(params.nextAdvanced?.[moduleKey]);
        const beforeVisible = Object.fromEntries(
            Object.entries(before).filter(([fieldKey]) => visibleKeys.includes(fieldKey))
        );
        const afterVisible = Object.fromEntries(
            Object.entries(after).filter(([fieldKey]) => visibleKeys.includes(fieldKey))
        );

        if (JSON.stringify(beforeVisible) !== JSON.stringify(afterVisible)) {
            changed.add(`advanced_${moduleKey}`);
        }
    }

    return Array.from(changed);
}

export function mergeAdvancedPacketDataPreservingExcluded({
    existingData,
    submittedVisibleData,
    enabledModules,
    exclusions,
}: {
    existingData: Record<string, unknown>;
    submittedVisibleData: Record<string, unknown>;
    enabledModules: AdvancedModuleKey[];
    exclusions: AdvancedModuleExclusions;
}): Record<string, unknown> {
    const merged: Record<string, unknown> = {};

    for (const moduleKey of enabledModules) {
        const existingSection = normalizeUnknownRecord(existingData[moduleKey]);
        const submittedSection = normalizeUnknownRecord(submittedVisibleData[moduleKey]);
        const visibleKeys = new Set(getAdvancedModuleVisibleFieldKeys(moduleKey, exclusions));
        const nextSection: Record<string, unknown> = {};

        for (const [fieldKey, fieldValue] of Object.entries(submittedSection)) {
            if (visibleKeys.has(fieldKey)) {
                nextSection[fieldKey] = fieldValue;
            }
        }

        for (const [fieldKey, fieldValue] of Object.entries(existingSection)) {
            if (!visibleKeys.has(fieldKey)) {
                nextSection[fieldKey] = fieldValue;
            }
        }

        if (Object.keys(nextSection).length > 0) {
            merged[moduleKey] = nextSection;
        }
    }

    return merged;
}

function hasMeaningfulTrashDetails(trashDetails: SubmittedSheetEditableTrashDetails): boolean {
    if (trashDetails.hasRecycling) return true;
    if (trashDetails.trashPickupDay) return true;
    if (trashDetails.trashPickupDays.length > 0) return true;
    return Boolean(trashDetails.recyclingPickupDay);
}

export type SubmittedSheetUtilityInsertRow = {
    category: UtilityCategory;
    entry_mode: 'free_text';
    display_name: string | null;
    raw_text: string | null;
    contact_phone: string | null;
    contact_url: string | null;
    meter_number: string | null;
    extra: Record<string, unknown>;
};

export function buildSubmittedSheetUtilityInsertRows(
    utilities: SubmittedSheetEditableUtilities
): SubmittedSheetUtilityInsertRow[] {
    const rows: SubmittedSheetUtilityInsertRow[] = [];

    for (const category of UTILITY_CATEGORY_KEYS) {
        const value = utilities[category];
        if (!value) continue;

        const providerName = value.providerName.trim();
        const contactPhone = value.contactPhone.trim();
        const contactUrl = value.contactUrl.trim();
        const meterNumber = value.meterNumber.trim();
        const trashDetails = value.trashDetails;
        const hasTrashDetails = category === 'trash' && hasMeaningfulTrashDetails(trashDetails);

        if (!providerName && !contactPhone && !contactUrl && !meterNumber && !hasTrashDetails) {
            continue;
        }

        const extra: Record<string, unknown> = {};
        if (category === 'trash') {
            if (trashDetails.hasRecycling) {
                extra.has_recycling = trashDetails.hasRecycling;
            }
            if (trashDetails.trashPickupDays.length > 0) {
                extra.trash_pickup_days = trashDetails.trashPickupDays;
                extra.trash_pickup_day = trashDetails.trashPickupDays[0];
            } else if (trashDetails.trashPickupDay) {
                extra.trash_pickup_day = trashDetails.trashPickupDay;
            }
            if (trashDetails.hasRecycling === 'no') {
                extra.recycling_pickup_day = null;
            } else if (trashDetails.recyclingPickupDay) {
                extra.recycling_pickup_day = trashDetails.recyclingPickupDay;
            }
        }

        rows.push({
            category,
            entry_mode: 'free_text',
            display_name: providerName || null,
            raw_text: providerName || null,
            contact_phone: contactPhone || null,
            contact_url: contactUrl || null,
            meter_number: meterNumber || null,
            extra,
        });
    }

    return rows;
}
