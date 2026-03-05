import type {
    AdvancedModuleExclusions,
    AdvancedModuleKey,
    PacketMode,
} from '@/types';

export const PACKET_MODES: PacketMode[] = ['simple', 'advanced'];

export const ADVANCED_MODULE_KEYS: AdvancedModuleKey[] = [
    'lawn_exterior',
    'irrigation_seasonal_controls',
    'mailbox_access',
    'smart_home_security',
    'service_providers',
];

export const ADVANCED_MODULE_LABELS: Record<AdvancedModuleKey, string> = {
    lawn_exterior: 'Lawn & Snow Care',
    irrigation_seasonal_controls: 'Irrigation & Watering',
    mailbox_access: 'Mailbox & Home Access',
    smart_home_security: 'Security & Smart Devices',
    service_providers: 'Home Service Contacts',
};

export const ADVANCED_MODULE_DEFAULTS: AdvancedModuleKey[] = [...ADVANCED_MODULE_KEYS];

export interface AdvancedModuleFieldMeta {
    key: string;
    label: string;
    sellerPrompt: string;
    example?: string;
    groupLabel?: string;
}

export interface AdvancedModuleMeta {
    key: AdvancedModuleKey;
    label: string;
    summary: string;
    sellerAsks: string;
    outputImpact: string;
    fields: AdvancedModuleFieldMeta[];
}

export const ADVANCED_MODULE_FIELD_KEYS: Record<AdvancedModuleKey, string[]> = {
    lawn_exterior: [
        'lawn_care_provider_name',
        'lawn_care_provider_phone',
        'snow_removal_provider_name',
        'snow_removal_provider_phone',
        'lawn_exterior_notes',
    ],
    irrigation_seasonal_controls: [
        'has_irrigation_system',
        'irrigation_provider_name',
        'irrigation_provider_phone',
        'watering_days',
        'irrigation_season_start_month',
        'irrigation_season_end_month',
        'irrigation_notes',
    ],
    mailbox_access: [
        'mailbox_number',
        'mailbox_location',
        'parking_instructions',
        'breaker_box_location',
        'main_water_shutoff_location',
    ],
    smart_home_security: [
        'security_system_brand',
        'smart_thermostat_brand',
        'smart_doorbell_brand',
        'smart_home_notes',
    ],
    service_providers: [
        'hvac_provider_name',
        'hvac_provider_phone',
        'pest_control_provider_name',
        'pest_control_provider_phone',
        'plumber_provider_name',
        'plumber_provider_phone',
        'service_provider_notes',
    ],
};

export const ADVANCED_MODULE_FIELD_METADATA: Record<AdvancedModuleKey, AdvancedModuleFieldMeta[]> = {
    lawn_exterior: [
        { key: 'lawn_care_provider_name', label: 'Lawn Care Provider', sellerPrompt: 'Who handles lawn care?', example: 'GreenScape Lawn', groupLabel: 'Lawn Care Contact' },
        { key: 'lawn_care_provider_phone', label: 'Lawn Care Phone', sellerPrompt: 'What is the lawn care phone number?', example: '(555) 123-4567', groupLabel: 'Lawn Care Contact' },
        { key: 'snow_removal_provider_name', label: 'Snow Removal Provider', sellerPrompt: 'Who handles snow removal?', example: 'Peak Winter Services', groupLabel: 'Snow Removal Contact' },
        { key: 'snow_removal_provider_phone', label: 'Snow Removal Phone', sellerPrompt: 'What is the snow removal phone number?', example: '(555) 987-6543', groupLabel: 'Snow Removal Contact' },
        { key: 'lawn_exterior_notes', label: 'Lawn & Exterior Notes', sellerPrompt: 'Any notes about seasonal care or contracts?', example: 'Weekly mowing through October' },
    ],
    irrigation_seasonal_controls: [
        { key: 'has_irrigation_system', label: 'Has Irrigation System', sellerPrompt: 'Is there an irrigation system?' },
        { key: 'irrigation_provider_name', label: 'Irrigation Provider', sellerPrompt: 'Who services irrigation?', example: 'BlueSprinkler Co.', groupLabel: 'Irrigation Contact' },
        { key: 'irrigation_provider_phone', label: 'Irrigation Phone', sellerPrompt: 'What is the irrigation phone number?', example: '(555) 222-3344', groupLabel: 'Irrigation Contact' },
        { key: 'watering_days', label: 'Watering Days', sellerPrompt: 'Which days are usually used for watering?' },
        { key: 'irrigation_season_start_month', label: 'Season Start Month', sellerPrompt: 'When does irrigation season typically start?' },
        { key: 'irrigation_season_end_month', label: 'Season End Month', sellerPrompt: 'When does irrigation season typically end?' },
        { key: 'irrigation_notes', label: 'Irrigation Notes', sellerPrompt: 'Any notes about timers or controllers?', example: 'Controller is in garage by entry door' },
    ],
    mailbox_access: [
        { key: 'mailbox_number', label: 'Mailbox Number', sellerPrompt: 'What is the mailbox number?', example: '12B' },
        { key: 'mailbox_location', label: 'Mailbox Location', sellerPrompt: 'Where is the mailbox located?', example: 'Cluster boxes by community entrance' },
        { key: 'parking_instructions', label: 'Parking Instructions', sellerPrompt: 'Any parking guidance for access?', example: 'Use visitor parking near clubhouse' },
        { key: 'breaker_box_location', label: 'Breaker Box Location', sellerPrompt: 'Where is the breaker panel?', example: 'Garage, left wall' },
        { key: 'main_water_shutoff_location', label: 'Main Water Shutoff Location', sellerPrompt: 'Where is the main water shutoff?', example: 'Utility room behind furnace' },
    ],
    smart_home_security: [
        { key: 'security_system_brand', label: 'Security System Brand', sellerPrompt: 'What security system is installed?', example: 'ADT' },
        { key: 'smart_thermostat_brand', label: 'Smart Thermostat Brand', sellerPrompt: 'What smart thermostat is installed?', example: 'Nest' },
        { key: 'smart_doorbell_brand', label: 'Smart Doorbell Brand', sellerPrompt: 'What smart doorbell is installed?', example: 'Ring' },
        { key: 'smart_home_notes', label: 'Smart Home Notes', sellerPrompt: 'Any setup or transfer notes for devices?', example: 'Transfer account in Ring app after closing' },
    ],
    service_providers: [
        { key: 'hvac_provider_name', label: 'HVAC Provider', sellerPrompt: 'Who services HVAC?', example: 'Comfort Air', groupLabel: 'HVAC Contact' },
        { key: 'hvac_provider_phone', label: 'HVAC Phone', sellerPrompt: 'What is the HVAC phone number?', example: '(555) 300-1000', groupLabel: 'HVAC Contact' },
        { key: 'pest_control_provider_name', label: 'Pest Control Provider', sellerPrompt: 'Who handles pest control?', example: 'SafeHome Pest', groupLabel: 'Pest Control Contact' },
        { key: 'pest_control_provider_phone', label: 'Pest Control Phone', sellerPrompt: 'What is the pest control phone number?', example: '(555) 300-2000', groupLabel: 'Pest Control Contact' },
        { key: 'plumber_provider_name', label: 'Plumber', sellerPrompt: 'Who is the usual plumber?', example: 'Rapid Rooter', groupLabel: 'Plumber Contact' },
        { key: 'plumber_provider_phone', label: 'Plumber Phone', sellerPrompt: 'What is the plumber phone number?', example: '(555) 300-3000', groupLabel: 'Plumber Contact' },
        { key: 'service_provider_notes', label: 'Service Provider Notes', sellerPrompt: 'Any service contracts or notes?', example: 'HVAC service plan renewed in March' },
    ],
};

export const ADVANCED_MODULE_METADATA: Record<AdvancedModuleKey, AdvancedModuleMeta> = {
    lawn_exterior: {
        key: 'lawn_exterior',
        label: ADVANCED_MODULE_LABELS.lawn_exterior,
        summary: 'Who handles lawn and snow care, plus outdoor handoff notes.',
        sellerAsks: 'Seller can share lawn and snow provider names/phones and seasonal notes.',
        outputImpact: 'Included fields appear in the Lawn & Snow Care section of the packet.',
        fields: ADVANCED_MODULE_FIELD_METADATA.lawn_exterior,
    },
    irrigation_seasonal_controls: {
        key: 'irrigation_seasonal_controls',
        label: ADVANCED_MODULE_LABELS.irrigation_seasonal_controls,
        summary: 'Irrigation contact, watering days, and season timing.',
        sellerAsks: 'Seller can share irrigation contact details, watering schedule, and controller notes.',
        outputImpact: 'Included fields appear in the Irrigation & Watering section of the packet.',
        fields: ADVANCED_MODULE_FIELD_METADATA.irrigation_seasonal_controls,
    },
    mailbox_access: {
        key: 'mailbox_access',
        label: ADVANCED_MODULE_LABELS.mailbox_access,
        summary: 'Mailbox location and key home access details.',
        sellerAsks: 'Seller can share mailbox details, parking notes, breaker panel, and main water shutoff location.',
        outputImpact: 'Included fields appear in the Mailbox & Home Access section of the packet.',
        fields: ADVANCED_MODULE_FIELD_METADATA.mailbox_access,
    },
    smart_home_security: {
        key: 'smart_home_security',
        label: ADVANCED_MODULE_LABELS.smart_home_security,
        summary: 'Alarm and smart device handoff details.',
        sellerAsks: 'Seller can share installed security/smart device brands and transfer notes.',
        outputImpact: 'Included fields appear in the Security & Smart Devices section of the packet.',
        fields: ADVANCED_MODULE_FIELD_METADATA.smart_home_security,
    },
    service_providers: {
        key: 'service_providers',
        label: ADVANCED_MODULE_LABELS.service_providers,
        summary: 'Recurring home service contacts.',
        sellerAsks: 'Seller can share HVAC, pest control, and plumber contacts plus optional notes.',
        outputImpact: 'Included fields appear in the Home Service Contacts section of the packet.',
        fields: ADVANCED_MODULE_FIELD_METADATA.service_providers,
    },
};

export function getAdvancedModuleMetadataList(moduleKeys?: AdvancedModuleKey[]): AdvancedModuleMeta[] {
    const keys = moduleKeys && moduleKeys.length > 0
        ? ADVANCED_MODULE_KEYS.filter((moduleKey) => moduleKeys.includes(moduleKey))
        : ADVANCED_MODULE_KEYS;
    return keys.map((moduleKey) => ADVANCED_MODULE_METADATA[moduleKey]);
}

export function getAdvancedModuleVisibleFieldKeys(
    moduleKey: AdvancedModuleKey,
    exclusions?: AdvancedModuleExclusions | null
): string[] {
    const allKeys = ADVANCED_MODULE_FIELD_KEYS[moduleKey];
    const excluded = new Set((exclusions?.[moduleKey] || []).filter((candidate) => typeof candidate === 'string'));
    return allKeys.filter((key) => !excluded.has(key));
}

export function getAdvancedModuleIncludedFieldCount(
    moduleKey: AdvancedModuleKey,
    exclusions?: AdvancedModuleExclusions | null
): number {
    return getAdvancedModuleVisibleFieldKeys(moduleKey, exclusions).length;
}

export function getEffectiveAdvancedModules(
    enabledModules: AdvancedModuleKey[],
    exclusions?: AdvancedModuleExclusions | null
): AdvancedModuleKey[] {
    const normalizedEnabled = ADVANCED_MODULE_KEYS.filter((moduleKey) => enabledModules.includes(moduleKey));
    return normalizedEnabled.filter((moduleKey) => getAdvancedModuleIncludedFieldCount(moduleKey, exclusions) > 0);
}

export function normalizeAdvancedModuleExclusions(
    input: unknown,
    enabledModules?: AdvancedModuleKey[] | null
): AdvancedModuleExclusions {
    const enabledSet = new Set<AdvancedModuleKey>(
        Array.isArray(enabledModules) && enabledModules.length > 0
            ? ADVANCED_MODULE_KEYS.filter((moduleKey) => enabledModules.includes(moduleKey))
            : ADVANCED_MODULE_KEYS
    );

    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return {};
    }

    const exclusions: AdvancedModuleExclusions = {};
    const record = input as Record<string, unknown>;

    for (const moduleKey of ADVANCED_MODULE_KEYS) {
        if (!enabledSet.has(moduleKey)) continue;

        const rawFields = record[moduleKey];
        if (!Array.isArray(rawFields) || rawFields.length === 0) continue;

        const allowedFieldKeys = ADVANCED_MODULE_FIELD_KEYS[moduleKey];
        const rawSet = new Set(
            rawFields
                .filter((candidate): candidate is string => typeof candidate === 'string')
                .map((fieldKey) => fieldKey.trim())
                .filter(Boolean)
        );
        const normalizedFields = allowedFieldKeys.filter((fieldKey) => rawSet.has(fieldKey));
        if (normalizedFields.length > 0) {
            exclusions[moduleKey] = normalizedFields;
        }
    }

    return exclusions;
}

export function filterAdvancedPacketDataByExclusions(
    data: unknown,
    enabledModules: AdvancedModuleKey[],
    exclusions?: AdvancedModuleExclusions | null
): Record<string, unknown> {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return {};
    }

    const source = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    const effectiveModules = getEffectiveAdvancedModules(enabledModules, exclusions);

    for (const moduleKey of effectiveModules) {
        const section = source[moduleKey];
        if (!section || typeof section !== 'object' || Array.isArray(section)) continue;

        const visibleKeys = new Set(getAdvancedModuleVisibleFieldKeys(moduleKey, exclusions));
        const filteredEntries = Object.entries(section as Record<string, unknown>)
            .filter(([fieldKey]) => visibleKeys.has(fieldKey));

        if (filteredEntries.length > 0) {
            result[moduleKey] = Object.fromEntries(filteredEntries);
        }
    }

    return result;
}

export function normalizeAdvancedModules(input?: string[] | null): AdvancedModuleKey[] {
    if (!Array.isArray(input) || input.length === 0) return [...ADVANCED_MODULE_DEFAULTS];
    const unique = new Set<AdvancedModuleKey>();
    for (const candidate of input) {
        if ((ADVANCED_MODULE_KEYS as string[]).includes(candidate)) {
            unique.add(candidate as AdvancedModuleKey);
        }
    }
    return unique.size > 0 ? Array.from(unique) : [...ADVANCED_MODULE_DEFAULTS];
}
