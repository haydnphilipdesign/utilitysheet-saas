import { UTILITY_CATEGORY_KEYS } from '@/lib/constants';
import {
    filterAdvancedPacketDataByExclusions,
    getAdvancedModuleVisibleFieldKeys,
    normalizeAdvancedModuleExclusions,
    normalizeAdvancedModules,
} from '@/lib/packet/modules';
import type {
    AdvancedModuleExclusions,
    AdvancedModuleKey,
    AdvancedPacketData,
    PacketMode,
    Request as StoredRequest,
    SubmittedSheetEditableHomeBasics,
    SubmittedSheetEditableTrashDetails,
    SubmittedSheetEditableUtilities,
    SubmittedSheetEditableUtility,
    SubmittedSheetEditorPayload,
    SubmittedSheetUtilityStatus,
    TrashPickupDay,
    UtilityCategory,
    UtilityEntry,
} from '@/types';

const EMPTY_TRASH_DETAILS: SubmittedSheetEditableTrashDetails = {
    hasRecycling: '',
    trashPickupDay: '',
    trashPickupDays: [],
    recyclingPickupDay: '',
    recyclingPickupDays: [],
};

export function createEmptySubmittedSheetUtility(): SubmittedSheetEditableUtility {
    return {
        status: 'not_included',
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
    const recyclingPickupDays = normalizeTrashPickupDays(input.recycling_pickup_days);
    const legacyRecyclingPickupDay = normalizeTrashPickupDay(input.recycling_pickup_day);

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
        recyclingPickupDay: recyclingPickupDays[0] || legacyRecyclingPickupDay,
        recyclingPickupDays: recyclingPickupDays.length > 0
            ? recyclingPickupDays
            : legacyRecyclingPickupDay
                ? [legacyRecyclingPickupDay]
                : [],
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
        const providerName = (existing?.display_name || existing?.raw_text || '').trim();
        utilities[category] = {
            status: !existing ? 'not_included' : providerName ? 'provider' : 'not_sure',
            providerName,
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

function hasMeaningfulTrashDetails(trashDetails: SubmittedSheetEditableTrashDetails): boolean {
    if (trashDetails.hasRecycling) return true;
    if (trashDetails.trashPickupDay) return true;
    if (trashDetails.trashPickupDays.length > 0) return true;
    if (trashDetails.recyclingPickupDays.length > 0) return true;
    return Boolean(trashDetails.recyclingPickupDay);
}

/**
 * Status for a payload sent without one (an editor tab loaded before statuses
 * existed). Mirrors the earlier save behavior: a name means a provider, other
 * details without a name mean "Not sure", and an empty utility is left off.
 */
export function inferSubmittedSheetUtilityStatus(
    value: Omit<SubmittedSheetEditableUtility, 'status'>
): SubmittedSheetUtilityStatus {
    if (value.providerName.trim()) return 'provider';
    const hasDetails = Boolean(value.contactPhone.trim() || value.contactUrl.trim() || value.meterNumber.trim())
        || hasMeaningfulTrashDetails(value.trashDetails);
    return hasDetails ? 'not_sure' : 'not_included';
}

function normalizeUtilityForComparison(value: SubmittedSheetEditableUtility | undefined) {
    if (!value || value.status === 'not_included') return null;
    return {
        status: value.status,
        providerName: value.status === 'provider' ? value.providerName.trim() : '',
        contactPhone: value.contactPhone.trim(),
        contactUrl: value.contactUrl.trim(),
        meterNumber: value.meterNumber.trim(),
        trashDetails: {
            hasRecycling: value.trashDetails.hasRecycling,
            trashPickupDay: value.trashDetails.trashPickupDay,
            trashPickupDays: [...value.trashDetails.trashPickupDays],
            recyclingPickupDay: value.trashDetails.hasRecycling === 'no' ? '' : value.trashDetails.recyclingPickupDay,
            recyclingPickupDays: value.trashDetails.hasRecycling === 'no' ? [] : [...value.trashDetails.recyclingPickupDays],
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
    existingHomeBasics?: SubmittedSheetEditableHomeBasics;
    nextHomeBasics?: SubmittedSheetEditableHomeBasics;
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

    if (params.existingHomeBasics && params.nextHomeBasics) {
        if ((params.existingHomeBasics.waterSource || null) !== (params.nextHomeBasics.waterSource || null)) {
            changed.add('water_source');
        }
        if ((params.existingHomeBasics.sewerType || null) !== (params.nextHomeBasics.sewerType || null)) {
            changed.add('sewer_type');
        }
        if ((params.existingHomeBasics.heatingType || null) !== (params.nextHomeBasics.heatingType || null)) {
            changed.add('heating_type');
        }
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

export type SubmittedSheetUtilityInsertRow = {
    category: UtilityCategory;
    entry_mode: 'free_text' | 'unknown';
    display_name: string | null;
    raw_text: string | null;
    contact_phone: string | null;
    contact_url: string | null;
    meter_number: string | null;
    extra: Record<string, unknown>;
};

/**
 * Converts editor utilities to stored rows. `not_included` utilities get no row
 * (omitted from the packet and PDF). `not_sure` utilities keep a nameless
 * `unknown` row, which the packet prints as "Not sure", together with any
 * phone, website, meter, or trash details.
 */
export function buildSubmittedSheetUtilityInsertRows(
    utilities: SubmittedSheetEditableUtilities
): SubmittedSheetUtilityInsertRow[] {
    const rows: SubmittedSheetUtilityInsertRow[] = [];

    for (const category of UTILITY_CATEGORY_KEYS) {
        const value = utilities[category];
        if (!value || value.status === 'not_included') continue;

        const providerName = value.status === 'provider' ? value.providerName.trim() : '';
        const trashDetails = value.trashDetails;

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
            } else if (trashDetails.recyclingPickupDays.length > 0) {
                extra.recycling_pickup_days = trashDetails.recyclingPickupDays;
                extra.recycling_pickup_day = trashDetails.recyclingPickupDays[0];
            } else if (trashDetails.recyclingPickupDay) {
                extra.recycling_pickup_day = trashDetails.recyclingPickupDay;
            }
        }

        rows.push({
            category,
            entry_mode: providerName ? 'free_text' : 'unknown',
            display_name: providerName || null,
            raw_text: providerName || null,
            contact_phone: value.contactPhone.trim() || null,
            contact_url: value.contactUrl.trim() || null,
            meter_number: value.meterNumber.trim() || null,
            extra,
        });
    }

    return rows;
}

export type SubmittedSheetEditableRequestRecord = StoredRequest & {
    utility_categories?: UtilityCategory[] | null;
    packet_mode?: PacketMode | null;
    advanced_modules?: AdvancedModuleKey[] | null;
    advanced_module_exclusions?: AdvancedModuleExclusions | null;
    advanced_packet_data?: AdvancedPacketData | null;
};

export function buildSubmittedSheetEditorPayload({
    requestData,
    utilityEntries,
    collectElectricMeterNumber,
}: {
    requestData: SubmittedSheetEditableRequestRecord;
    utilityEntries: UtilityEntry[];
    collectElectricMeterNumber: boolean;
}): SubmittedSheetEditorPayload {
    const packetMode: PacketMode = requestData.packet_mode === 'advanced' ? 'advanced' : 'simple';
    const advancedModules = packetMode === 'advanced'
        ? normalizeAdvancedModules(requestData.advanced_modules || [])
        : [];
    const advancedModuleExclusions = packetMode === 'advanced'
        ? normalizeAdvancedModuleExclusions(
            requestData.advanced_module_exclusions || {},
            advancedModules
        )
        : {};
    const advanced = packetMode === 'advanced'
        ? filterAdvancedPacketDataByExclusions(
            requestData.advanced_packet_data || {},
            advancedModules,
            advancedModuleExclusions
        )
        : {};

    return {
        request: {
            id: requestData.id,
            publicToken: requestData.public_token,
            propertyAddress: requestData.property_address,
            sellerName: requestData.seller_name || null,
            sellerEmail: requestData.seller_email || null,
            sellerPhone: requestData.seller_phone || null,
            closingDate: requestData.closing_date || null,
            status: requestData.status,
            updatedAt: requestData.updated_at,
            packetMode,
            utilityCategories: requestData.utility_categories || [],
            advancedModules,
            advancedModuleExclusions,
            waterSource: requestData.water_source || null,
            sewerType: requestData.sewer_type || null,
            heatingType: requestData.heating_type || null,
        },
        editor: {
            collectElectricMeterNumber,
            utilities: buildSubmittedSheetUtilities(requestData.utility_categories, utilityEntries),
            advanced: advanced as AdvancedPacketData,
        },
    };
}
