import {
    getAccountById,
    getBrandProfile,
    getDefaultBrandProfile,
    getIntakeLinkByAccountId,
    getOrganizationById,
    getRequestById,
    getRequestByToken,
    getUtilityEntriesByRequestId,
} from '@/lib/neon/queries';
import type {
    AdvancedModuleExclusions,
    AdvancedModuleKey,
    PacketMode,
    Request,
    TrashPickupDay,
} from '@/types';
import {
    ADVANCED_MODULE_FIELD_METADATA,
    ADVANCED_MODULE_LABELS,
    filterAdvancedPacketDataByExclusions,
    getEffectiveAdvancedModules,
    normalizeAdvancedModuleExclusions,
    normalizeAdvancedModules,
} from '@/lib/packet/modules';

export const PACKET_LOCKED_MESSAGE = 'This seller packet is locked. Ask the agent to upgrade to view it.';

export interface PacketRequestData {
    id: string;
    property_address: string;
    created_at: string;
    water_source: string | null;
    sewer_type: string | null;
    heating_type: string | null;
}

export interface PacketBrandData {
    name: string;
    logo_url: string | null;
    primary_color: string;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    contact_website: string | null;
    disclaimer_text: string | null;
    company_name: string | null;
    professional_title: string | null;
    license_number: string | null;
    license_state: string | null;
    compliance_line: string | null;
    buyer_next_steps: string[] | null;
    next_steps_title: string | null;
    show_powered_by: boolean;
    show_generation_date: boolean;
    welcome_message: string | null;
}

export interface PacketUtilityData {
    category: string;
    provider_name: string;
    provider_phone: string | null;
    provider_website: string | null;
    meter_number?: string | null;
    trash_details?: {
        has_recycling?: 'yes' | 'no' | 'not_sure' | null;
        trash_pickup_day?: TrashPickupDay | null;
        trash_pickup_days?: TrashPickupDay[] | null;
        recycling_pickup_day?: TrashPickupDay | null;
        recycling_pickup_days?: TrashPickupDay[] | null;
    } | null;
}

export interface PacketDataPayload {
    mode: PacketMode;
    request: PacketRequestData;
    brand: PacketBrandData | null;
    utilities: PacketUtilityData[];
    advanced_sections?: PacketAdvancedSection[];
    meta: {
        show_powered_by: boolean;
        referral_code: string | null;
        is_demo: boolean;
    };
}

export interface PacketAdvancedField {
    key: string;
    label: string;
    value: string;
}

export interface PacketAdvancedSection {
    key: AdvancedModuleKey;
    title: string;
    fields: PacketAdvancedField[];
}

export type PacketDataResult =
    | { status: 'ok'; data: PacketDataPayload }
    | { status: 'not_found' }
    | { status: 'not_submitted' }
    | { status: 'locked'; message: string };

type RequestWithPacketFields = Request & {
    is_locked?: boolean | null;
    water_source?: string | null;
    sewer_type?: string | null;
    heating_type?: string | null;
    packet_mode?: PacketMode | null;
    advanced_modules?: AdvancedModuleKey[] | null;
    advanced_module_exclusions?: AdvancedModuleExclusions | null;
    advanced_packet_data?: Record<string, unknown> | null;
};

type RawUtilityRow = {
    category: string;
    provider_name?: string | null;
    display_name?: string | null;
    provider_display_name?: string | null;
    raw_text?: string | null;
    provider_phone?: string | null;
    contact_phone?: string | null;
    provider_website?: string | null;
    contact_url?: string | null;
    meter_number?: string | null;
    extra?: Record<string, unknown> | null;
};

const TRASH_PICKUP_DAYS = new Set<TrashPickupDay>([
    'mon',
    'tue',
    'wed',
    'thu',
    'fri',
    'sat',
    'sun',
    'varies',
    'not_sure',
]);

function normalizeSteps(value: unknown): string[] | null {
    if (value === null || value === undefined) return null;

    if (Array.isArray(value)) {
        return value
            .filter((step): step is string => typeof step === 'string')
            .map((step) => step.trim())
            .filter(Boolean);
    }

    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed
                    .filter((step): step is string => typeof step === 'string')
                    .map((step) => step.trim())
                    .filter(Boolean);
            }
        } catch {
            // Ignore malformed JSON and fall back to null
        }
    }

    return null;
}

function normalizeObject(value: unknown): Record<string, unknown> {
    if (!value) return {};
    if (typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed as Record<string, unknown>;
            }
        } catch {
            // ignore
        }
    }
    return {};
}

function normalizeTrashPickupDay(value: unknown): TrashPickupDay | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim().toLowerCase();
    if (normalized === '') return null;
    return TRASH_PICKUP_DAYS.has(normalized as TrashPickupDay)
        ? (normalized as TrashPickupDay)
        : undefined;
}

function normalizeTrashPickupDays(value: unknown): TrashPickupDay[] | undefined {
    if (value === undefined || value === null) return undefined;
    if (!Array.isArray(value)) return undefined;

    const days: TrashPickupDay[] = [];
    for (const item of value) {
        const normalized = normalizeTrashPickupDay(item);
        if (normalized && !days.includes(normalized)) {
            days.push(normalized);
        }
    }

    return days.length > 0 ? days : undefined;
}

function normalizeTrashDetails(value: unknown): PacketUtilityData['trash_details'] {
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return normalizeTrashDetails(parsed);
        } catch {
            return null;
        }
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const input = value as Record<string, unknown>;
    const normalized: NonNullable<PacketUtilityData['trash_details']> = {};

    if (typeof input.has_recycling === 'string') {
        const hasRecycling = input.has_recycling.trim().toLowerCase();
        if (hasRecycling === 'yes' || hasRecycling === 'no' || hasRecycling === 'not_sure') {
            normalized.has_recycling = hasRecycling;
        }
    } else if (input.has_recycling === null) {
        normalized.has_recycling = null;
    }

    const trashPickupDays = normalizeTrashPickupDays(input.trash_pickup_days);
    if (trashPickupDays !== undefined) {
        normalized.trash_pickup_days = trashPickupDays;
        normalized.trash_pickup_day = trashPickupDays[0] ?? null;
    } else {
        const trashPickupDay = normalizeTrashPickupDay(input.trash_pickup_day);
        if (trashPickupDay !== undefined) {
            normalized.trash_pickup_day = trashPickupDay;
        }
    }

    const recyclingPickupDays = normalizeTrashPickupDays(input.recycling_pickup_days);
    if (recyclingPickupDays !== undefined) {
        normalized.recycling_pickup_days = recyclingPickupDays;
        normalized.recycling_pickup_day = recyclingPickupDays[0] ?? null;
    } else {
        const recyclingPickupDay = normalizeTrashPickupDay(input.recycling_pickup_day);
        if (recyclingPickupDay !== undefined) {
            normalized.recycling_pickup_day = recyclingPickupDay;
        }
    }

    if (normalized.has_recycling === 'no') {
        normalized.recycling_pickup_day = null;
        delete normalized.recycling_pickup_days;
    }

    return Object.keys(normalized).length > 0 ? normalized : null;
}

function formatAdvancedDisplayValue(raw: unknown): string | null {
    if (raw === null || raw === undefined) return null;
    const value = Array.isArray(raw) ? raw.join(', ') : String(raw).trim();

    if (!value) return null;
    if (value.toLowerCase() === 'yes') return 'Yes';
    if (value.toLowerCase() === 'no') return 'No';
    return value;
}

function normalizeAdvancedSections(
    modules: AdvancedModuleKey[],
    data: Record<string, unknown>
): PacketAdvancedSection[] {
    return modules.map((moduleKey) => {
        const sectionData = normalizeObject(data[moduleKey]);
        const fields: PacketAdvancedField[] = ADVANCED_MODULE_FIELD_METADATA[moduleKey]
            .flatMap(({ key, label }) => {
                const value = formatAdvancedDisplayValue(sectionData[key]);
                if (value === null) return [];
                return [{
                    key,
                    label,
                    value,
                }];
            });

        return {
            key: moduleKey,
            title: ADVANCED_MODULE_LABELS[moduleKey],
            fields,
        };
    }).filter((section) => section.fields.length > 0);
}

async function buildPacketDataFromRequest(requestData: Request): Promise<PacketDataResult> {
    const requestWithPacketFields = requestData as RequestWithPacketFields;

    if (requestData.status !== 'submitted') {
        return { status: 'not_submitted' };
    }

    let brandProfile = null;
    if (requestData.brand_profile_id) {
        brandProfile = await getBrandProfile(requestData.brand_profile_id);
    }

    if (!brandProfile) {
        brandProfile = await getDefaultBrandProfile(requestData.account_id, requestData.organization_id ?? undefined);
    }

    const account = await getAccountById(requestData.account_id);
    const organization = requestData.organization_id ? await getOrganizationById(requestData.organization_id) : null;
    const isPro = account?.subscription_status === 'pro' || organization?.subscription_status === 'team';
    const isTestDrive = requestWithPacketFields.is_demo === true;

    const isLocked = Boolean(requestWithPacketFields.is_locked);
    if (isLocked && !isPro) {
        return { status: 'locked', message: PACKET_LOCKED_MESSAGE };
    }

    const forceShowPoweredBy = !isPro;
    // Paid accounts can voluntarily keep UtilitySheet branding on their
    // deliverable; when they do, their packet carries the referral path too.
    const showsPoweredByVoluntarily = !forceShowPoweredBy && Boolean(brandProfile?.show_powered_by);
    const intakeLink = !isTestDrive && (forceShowPoweredBy || showsPoweredByVoluntarily)
        ? await getIntakeLinkByAccountId(requestData.account_id)
        : null;
    const buyerNextSteps = isPro ? normalizeSteps(brandProfile?.buyer_next_steps) : null;

    const publicBrandProfile: PacketBrandData | null = brandProfile
        ? {
            name: brandProfile.name,
            logo_url: brandProfile.logo_url,
            primary_color: brandProfile.primary_color,
            contact_name: brandProfile.contact_name,
            contact_email: brandProfile.contact_email,
            contact_phone: brandProfile.contact_phone,
            contact_website: brandProfile.contact_website,
            disclaimer_text: brandProfile.disclaimer_text ?? null,
            // Structured identity/compliance fields pass through on every plan,
            // like the core contact fields and disclaimer.
            company_name: brandProfile.company_name ?? null,
            professional_title: brandProfile.professional_title ?? null,
            license_number: brandProfile.license_number ?? null,
            license_state: brandProfile.license_state ?? null,
            compliance_line: brandProfile.compliance_line ?? null,
            buyer_next_steps: buyerNextSteps,
            next_steps_title: isPro ? (brandProfile.next_steps_title ?? null) : null,
            show_powered_by: forceShowPoweredBy ? true : Boolean(brandProfile.show_powered_by),
            show_generation_date: isPro ? (brandProfile.show_generation_date ?? true) : true,
            welcome_message: isPro ? (brandProfile.welcome_message ?? null) : null,
        }
        : null;

    const rawUtilities = await getUtilityEntriesByRequestId(requestData.id) as RawUtilityRow[];
    const utilities: PacketUtilityData[] = rawUtilities.map((utility) => ({
        category: utility.category,
        provider_name: utility.provider_name || utility.display_name || utility.provider_display_name || utility.raw_text || 'Not sure',
        provider_phone: utility.provider_phone || utility.contact_phone || null,
        provider_website: utility.provider_website || utility.contact_url || null,
        meter_number: utility.meter_number || null,
        trash_details: utility.category === 'trash'
            ? normalizeTrashDetails(utility.extra)
            : null,
    }));

    const mode: PacketMode = requestWithPacketFields.packet_mode === 'advanced' ? 'advanced' : 'simple';
    const advancedModules = mode === 'advanced'
        ? normalizeAdvancedModules(requestWithPacketFields.advanced_modules as string[] | undefined)
        : [];
    const advancedModuleExclusions = mode === 'advanced'
        ? normalizeAdvancedModuleExclusions(
            requestWithPacketFields.advanced_module_exclusions || {},
            advancedModules
        )
        : {};
    const effectiveAdvancedModules = mode === 'advanced'
        ? getEffectiveAdvancedModules(advancedModules, advancedModuleExclusions)
        : [];
    const advancedPacketData = normalizeObject(requestWithPacketFields.advanced_packet_data);
    const filteredAdvancedPacketData = mode === 'advanced'
        ? filterAdvancedPacketDataByExclusions(
            advancedPacketData,
            advancedModules,
            advancedModuleExclusions
        )
        : {};
    const advancedSections = mode === 'advanced'
        ? normalizeAdvancedSections(effectiveAdvancedModules, filteredAdvancedPacketData)
        : [];

    return {
        status: 'ok',
        data: {
            mode,
            request: {
                id: requestData.id,
                property_address: requestData.property_address,
                created_at: requestData.created_at,
                water_source: requestWithPacketFields.water_source || null,
                sewer_type: requestWithPacketFields.sewer_type || null,
                heating_type: requestWithPacketFields.heating_type || null,
            },
            brand: publicBrandProfile,
            utilities,
            advanced_sections: advancedSections,
            meta: {
                show_powered_by: forceShowPoweredBy,
                referral_code: isTestDrive ? null : (intakeLink?.slug || null),
                is_demo: isTestDrive,
            },
        },
    };
}

export async function getPacketDataByPublicToken(token: string): Promise<PacketDataResult> {
    const requestData = await getRequestByToken(token);
    if (!requestData) {
        return { status: 'not_found' };
    }

    return buildPacketDataFromRequest(requestData);
}

export async function getPacketDataByRequestId(requestId: string): Promise<PacketDataResult> {
    const requestData = await getRequestById(requestId);
    if (!requestData) {
        return { status: 'not_found' };
    }

    return buildPacketDataFromRequest(requestData);
}
