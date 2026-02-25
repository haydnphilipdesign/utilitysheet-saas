import {
    getAccountById,
    getBrandProfile,
    getDefaultBrandProfile,
    getOrganizationById,
    getRequestById,
    getRequestByToken,
    getUtilityEntriesByRequestId,
} from '@/lib/neon/queries';
import type { AdvancedModuleKey, PacketMode, Request } from '@/types';
import { ADVANCED_MODULE_LABELS, normalizeAdvancedModules } from '@/lib/packet/modules';

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
}

export interface PacketDataPayload {
    mode: PacketMode;
    request: PacketRequestData;
    brand: PacketBrandData | null;
    utilities: PacketUtilityData[];
    advanced_sections?: PacketAdvancedSection[];
    meta: {
        show_powered_by: boolean;
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
};

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

function toLabel(key: string): string {
    return key
        .replaceAll('_', ' ')
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function normalizeAdvancedSections(
    modules: AdvancedModuleKey[],
    data: Record<string, unknown>
): PacketAdvancedSection[] {
    return modules.map((moduleKey) => {
        const sectionData = normalizeObject(data[moduleKey]);
        const fields: PacketAdvancedField[] = Object.entries(sectionData)
            .flatMap(([key, raw]) => {
                if (raw === null || raw === undefined) return [];
                const value = Array.isArray(raw) ? raw.join(', ') : String(raw).trim();
                if (!value) return [];
                return [{
                    key,
                    label: toLabel(key),
                    value,
                }];
            });

        return {
            key: moduleKey,
            title: ADVANCED_MODULE_LABELS[moduleKey],
            fields,
        };
    });
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

    const isLocked = Boolean(requestWithPacketFields.is_locked);
    if (isLocked && !isPro) {
        return { status: 'locked', message: PACKET_LOCKED_MESSAGE };
    }

    const forceShowPoweredBy = !isPro;
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
    }));

    const mode: PacketMode = requestWithPacketFields.packet_mode === 'advanced' ? 'advanced' : 'simple';
    const advancedModules = mode === 'advanced'
        ? normalizeAdvancedModules(requestWithPacketFields.advanced_modules as string[] | undefined)
        : [];
    const advancedPacketData = normalizeObject(requestWithPacketFields.advanced_packet_data);
    const advancedSections = mode === 'advanced'
        ? normalizeAdvancedSections(advancedModules, advancedPacketData)
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
