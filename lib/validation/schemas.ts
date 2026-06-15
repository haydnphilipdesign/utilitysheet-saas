import { z } from 'zod';
import type { UtilityCategory } from '@/types';
import { UTILITY_CATEGORY_KEYS } from '@/lib/constants';
import { BRAND_PROFILE_LIMITS } from '@/lib/branding/limits';
import {
    ADVANCED_MODULE_KEYS,
    normalizeAdvancedModuleExclusions,
    normalizeAdvancedModules,
    PACKET_MODES,
} from '@/lib/packet/modules';

export const utilityCategoryEnum = z.enum(
    UTILITY_CATEGORY_KEYS as [UtilityCategory, ...UtilityCategory[]]
);

const isHttpUrl = (value: string) => value.startsWith('https://') || value.startsWith('http://');
const allowedUtilityCategories = new Set<string>(UTILITY_CATEGORY_KEYS);

export const createRequestBodySchema = z.object({
    propertyAddress: z.string().trim().min(5).max(200),
    sellerName: z.string().trim().min(1).max(120).optional(),
    sellerEmail: z.string().trim().email().optional(),
    sellerPhone: z.string().trim().min(1).max(30).optional(),
    closingDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    utilityCategories: z.array(utilityCategoryEnum).min(1).max(UTILITY_CATEGORY_KEYS.length).optional(),
    packetMode: z.enum(PACKET_MODES as ['simple', 'advanced']).optional(),
    advancedModules: z.array(z.enum(ADVANCED_MODULE_KEYS as ['lawn_exterior', 'irrigation_seasonal_controls', 'mailbox_access', 'smart_home_security', 'service_providers'])).optional(),
    advancedModuleExclusions: z.record(z.string(), z.array(z.string())).optional(),
    brandProfileId: z.string().uuid().optional(),
    sendSellerEmail: z.boolean().optional(),
    isDemo: z.boolean().optional(),
}).strict();

const waterSourceEnum = z.enum(['city', 'well', 'hoa', 'not_sure']);
const sewerTypeEnum = z.enum(['public', 'septic', 'hoa', 'not_sure']);
const heatingTypeEnum = z.enum(['natural_gas', 'propane', 'oil', 'electric', 'not_sure']);
const heatingFuelEnum = z.enum(['natural_gas', 'propane', 'oil', 'electric']);
const providerEntryModeEnum = z.enum([
    'suggested_confirmed',
    'search_selected',
    'free_text',
    'unknown',
    'not_applicable',
]);
const packetModeEnum = z.enum(['simple', 'advanced']);
const advancedModuleEnum = z.enum([
    'lawn_exterior',
    'irrigation_seasonal_controls',
    'mailbox_access',
    'smart_home_security',
    'service_providers',
]);

const nullToUndefined = (val: unknown) => (val === null ? undefined : val);

const hexColorSchema = z.string().trim().regex(/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/, {
    message: 'Must be a valid hex color (e.g. #10b981)',
});

const optionalLimitedString = (maxLength: number) =>
    z.preprocess(nullToUndefined, z.string().trim().max(maxLength).optional());

const optionalMultilineString = (maxLength: number) =>
    z.preprocess(nullToUndefined, z.string().max(maxLength).optional());
const optionalNullableText = (maxLength: number) =>
    z.preprocess(
        (val) => {
            if (val === undefined || val === null) return null;
            if (typeof val !== 'string') return null;
            const trimmed = val.trim();
            return trimmed.length === 0 ? null : trimmed;
        },
        z.string().max(maxLength).nullable()
    );

const buyerNextStepsSchema = z.preprocess(
    nullToUndefined,
    z
        .array(z.string().trim().min(1).max(BRAND_PROFILE_LIMITS.buyerNextStepMax))
        .max(BRAND_PROFILE_LIMITS.buyerNextStepsMaxItems)
        .optional()
);

const messageTemplatesSchema = z.preprocess(
    nullToUndefined,
    z
        .object({
            seller_request: z
                .object({
                    sms: optionalMultilineString(500),
                    mailto: z
                        .object({
                            subject: optionalLimitedString(200),
                            body: optionalMultilineString(6000),
                        })
                        .partial()
                        .optional(),
                    email: z
                        .object({
                            subject: optionalLimitedString(200),
                            body: optionalMultilineString(12000),
                            button_text: optionalLimitedString(80),
                        })
                        .partial()
                        .optional(),
                })
                .partial()
                .optional(),
            seller_reminder: z
                .object({
                    email: z
                        .object({
                            subject: optionalLimitedString(200),
                            body: optionalMultilineString(12000),
                            button_text: optionalLimitedString(80),
                        })
                        .partial()
                        .optional(),
                })
                .partial()
                .optional(),
        })
        .partial()
        .optional()
);

export const brandProfileCreateBodySchema = z
    .object({
        name: z.string().trim().min(1).max(BRAND_PROFILE_LIMITS.brandNameMax),
        logo_url: optionalLimitedString(2048),
        primary_color: hexColorSchema,
        secondary_color: hexColorSchema,
        contact_name: optionalLimitedString(BRAND_PROFILE_LIMITS.contactNameMax),
        contact_phone: optionalLimitedString(BRAND_PROFILE_LIMITS.contactPhoneMax),
        contact_email: optionalLimitedString(BRAND_PROFILE_LIMITS.contactEmailMax),
        contact_website: optionalLimitedString(BRAND_PROFILE_LIMITS.contactWebsiteMax),
        disclaimer_text: optionalLimitedString(BRAND_PROFILE_LIMITS.disclaimerTextMax),
        message_templates: messageTemplatesSchema,
        is_default: z.preprocess(nullToUndefined, z.boolean().optional()),
        // Advanced customization
        buyer_next_steps: buyerNextStepsSchema,
        next_steps_title: optionalLimitedString(BRAND_PROFILE_LIMITS.nextStepsTitleMax),
        show_powered_by: z.preprocess(nullToUndefined, z.boolean().optional()),
        show_generation_date: z.preprocess(nullToUndefined, z.boolean().optional()),
        welcome_message: optionalLimitedString(BRAND_PROFILE_LIMITS.welcomeMessageMax),
    })
    .strip();

export const brandProfileUpdateBodySchema = brandProfileCreateBodySchema.partial();

const normalizeHttpUrlOrNull = (val: unknown): string | null | undefined => {
    if (val === undefined) return undefined;
    if (val === null) return null;
    if (typeof val !== 'string') return null;

    const trimmed = val.trim();
    if (trimmed === '') return null;

    const withScheme = isHttpUrl(trimmed) ? trimmed : `https://${trimmed}`;

    try {
        const parsed = new URL(withScheme);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        return parsed.toString();
    } catch {
        return null;
    }
};

// Preprocessor to convert empty strings/invalid URLs to null (and allow missing scheme)
const httpUrlSchemaFlexible = z.preprocess(
    normalizeHttpUrlOrNull,
    z.union([
        z.string().url().refine(isHttpUrl, { message: 'Must be an http(s) URL' }),
        z.null(),
    ])
);

const utilityWizardStateSchema = z.object({
    entry_mode: z.preprocess(nullToUndefined, providerEntryModeEnum.nullable().default(null)),
    display_name: z.preprocess(nullToUndefined, z.string().trim().max(200).nullable().default(null)),
    raw_text: z.preprocess(nullToUndefined, z.string().trim().max(500).nullable().default(null)),
    meter_number: z.preprocess(nullToUndefined, z.string().trim().max(64).nullable().default(null)),
    hidden: z.boolean().optional().default(false),
    canonical_id: z.preprocess(nullToUndefined, z.string().trim().max(120).nullable().optional()),
    confidence_score: z.coerce.number().min(0).max(1).nullable().optional(),
    contact_phone: z.string().trim().max(50).nullable().optional(),
    contact_url: httpUrlSchemaFlexible.optional(),
    extra: z.record(z.string(), z.unknown()).optional(),
}).passthrough(); // Allow extra fields

const wateringDayEnum = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
const trashRecyclingEnum = z.enum(['yes', 'no', 'not_sure']);
const trashPickupDayEnum = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'varies', 'not_sure']);

const submittedSheetEditableTrashDetailsSchema = z.object({
    hasRecycling: z.preprocess(nullToUndefined, z.union([z.literal('yes'), z.literal('no'), z.literal('not_sure'), z.literal('')]).optional()).default(''),
    trashPickupDay: z.preprocess(nullToUndefined, z.union([trashPickupDayEnum, z.literal('')]).optional()).default(''),
    trashPickupDays: z.preprocess(nullToUndefined, z.array(trashPickupDayEnum).max(7).optional()).default([]),
    recyclingPickupDay: z.preprocess(nullToUndefined, z.union([trashPickupDayEnum, z.literal('')]).optional()).default(''),
}).default({
    hasRecycling: '',
    trashPickupDay: '',
    trashPickupDays: [],
    recyclingPickupDay: '',
});

const submittedSheetEditableUtilitySchema = z.object({
    providerName: z.preprocess(nullToUndefined, z.string().trim().max(200).optional()).default(''),
    contactPhone: z.preprocess(nullToUndefined, z.string().trim().max(50).optional()).default(''),
    contactUrl: z.preprocess(
        (val) => {
            const normalized = normalizeHttpUrlOrNull(val);
            return normalized === null ? '' : normalized;
        },
        z.union([z.string().url().refine(isHttpUrl, { message: 'Must be an http(s) URL' }), z.literal('')])
    ).default(''),
    meterNumber: z.preprocess(nullToUndefined, z.string().trim().max(64).optional()).default(''),
    trashDetails: submittedSheetEditableTrashDetailsSchema,
}).strict();

function normalizeTrashPickupDay(value: unknown): z.infer<typeof trashPickupDayEnum> | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim().toLowerCase();
    if (normalized === '') return null;
    return trashPickupDayEnum.options.includes(normalized as z.infer<typeof trashPickupDayEnum>)
        ? normalized as z.infer<typeof trashPickupDayEnum>
        : undefined;
}

function normalizeTrashPickupDays(value: unknown): z.infer<typeof trashPickupDayEnum>[] | undefined {
    if (value === undefined || value === null) return undefined;
    if (!Array.isArray(value)) return undefined;

    const days: z.infer<typeof trashPickupDayEnum>[] = [];
    for (const item of value) {
        const normalized = normalizeTrashPickupDay(item);
        if (normalized && !days.includes(normalized)) {
            days.push(normalized);
        }
    }

    return days.length > 0 ? days : undefined;
}

function normalizeTrashExtra(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

    const input = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    const hasRecycling = input.has_recycling;

    if (typeof hasRecycling === 'string') {
        const next = hasRecycling.trim().toLowerCase();
        if (trashRecyclingEnum.options.includes(next as z.infer<typeof trashRecyclingEnum>)) {
            normalized.has_recycling = next;
        }
    } else if (hasRecycling === null) {
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

    const recyclingPickupDay = normalizeTrashPickupDay(input.recycling_pickup_day);
    if (recyclingPickupDay !== undefined) {
        normalized.recycling_pickup_day = recyclingPickupDay;
    }

    if (normalized.has_recycling === 'no') {
        normalized.recycling_pickup_day = null;
    }

    return Object.keys(normalized).length > 0 ? normalized : undefined;
}

const advancedModuleDataSchema = z.object({
    lawn_exterior: z.object({
        lawn_care_provider_name: optionalNullableText(120).optional(),
        lawn_care_provider_phone: optionalNullableText(40).optional(),
        snow_removal_provider_name: optionalNullableText(120).optional(),
        snow_removal_provider_phone: optionalNullableText(40).optional(),
        lawn_exterior_notes: optionalNullableText(600).optional(),
    }).partial().optional(),
    irrigation_seasonal_controls: z.object({
        has_irrigation_system: z.preprocess(nullToUndefined, z.enum(['yes', 'no', 'not_sure']).optional()),
        irrigation_provider_name: optionalNullableText(120).optional(),
        irrigation_provider_phone: optionalNullableText(40).optional(),
        watering_days: z.preprocess(
            nullToUndefined,
            z.array(wateringDayEnum).max(7).optional()
        ),
        irrigation_season_start_month: optionalNullableText(32).optional(),
        irrigation_season_end_month: optionalNullableText(32).optional(),
        irrigation_notes: optionalNullableText(600).optional(),
    }).partial().optional(),
    mailbox_access: z.object({
        mailbox_number: optionalNullableText(80).optional(),
        mailbox_location: optionalNullableText(300).optional(),
        parking_instructions: optionalNullableText(400).optional(),
        breaker_box_location: optionalNullableText(300).optional(),
        main_water_shutoff_location: optionalNullableText(300).optional(),
    }).partial().optional(),
    smart_home_security: z.object({
        security_system_brand: optionalNullableText(120).optional(),
        smart_thermostat_brand: optionalNullableText(120).optional(),
        smart_doorbell_brand: optionalNullableText(120).optional(),
        smart_home_notes: optionalNullableText(600).optional(),
    }).partial().optional(),
    service_providers: z.object({
        hvac_provider_name: optionalNullableText(120).optional(),
        hvac_provider_phone: optionalNullableText(40).optional(),
        pest_control_provider_name: optionalNullableText(120).optional(),
        pest_control_provider_phone: optionalNullableText(40).optional(),
        plumber_provider_name: optionalNullableText(120).optional(),
        plumber_provider_phone: optionalNullableText(40).optional(),
        service_provider_notes: optionalNullableText(600).optional(),
    }).partial().optional(),
}).partial();

export const sellerSubmissionBodySchema = z.object({
    water_source: waterSourceEnum,
    sewer_type: sewerTypeEnum,
    heating_type: heatingTypeEnum,
    fuels_present: z.array(heatingFuelEnum).max(4),
    primary_heating_type: heatingFuelEnum.nullable(),
    trash_handled_by: z.enum(['municipal', 'private', 'not_sure']),
    optional_utilities: z.array(z.enum(['trash', 'internet', 'cable'])).optional(),
    packet_mode: packetModeEnum.optional(),
    advanced_modules: z.preprocess(
        (val) => {
            if (val === undefined || val === null) return undefined;
            return normalizeAdvancedModules(Array.isArray(val) ? val as string[] : undefined);
        },
        z.array(advancedModuleEnum)
    ).optional(),
    advanced_module_exclusions: z.preprocess(
        (val) => {
            if (val === undefined || val === null) return undefined;
            return normalizeAdvancedModuleExclusions(val);
        },
        z.record(z.string(), z.array(z.string()))
    ).optional(),
    advanced: advancedModuleDataSchema.optional(),
    utilities: z.preprocess(
        (val) => {
            const input = val;
            if (!input || typeof input !== 'object' || Array.isArray(input)) return input;

            const filtered: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
                if (allowedUtilityCategories.has(k)) {
                    if (k === 'trash' && v && typeof v === 'object' && !Array.isArray(v)) {
                        const trashEntry = { ...(v as Record<string, unknown>) };
                        const normalizedExtra = normalizeTrashExtra(trashEntry.extra);
                        if (normalizedExtra) {
                            trashEntry.extra = normalizedExtra;
                        } else {
                            delete trashEntry.extra;
                        }
                        filtered[k] = trashEntry;
                        continue;
                    }
                    filtered[k] = v;
                }
            }
            return filtered;
        },
        z
            .record(z.string(), utilityWizardStateSchema)
            .refine((obj) => Object.keys(obj).length <= UTILITY_CATEGORY_KEYS.length, {
                message: 'Too many utility entries',
            })
    ),
}).passthrough(); // Allow extra fields like optional_utilities variants

export const requestConfigurationBodySchema = z.object({
    packetMode: packetModeEnum,
    advancedModules: z.array(advancedModuleEnum).optional(),
    advancedModuleExclusions: z.preprocess(
        (val) => {
            if (val === undefined || val === null) return undefined;
            return normalizeAdvancedModuleExclusions(val);
        },
        z.record(z.string(), z.array(z.string())).optional()
    ),
}).strict();

export const submittedSheetUpdateBodySchema = z.object({
    updatedAt: z.string().datetime({ offset: true }),
    propertyAddress: z.string().trim().min(5).max(200),
    advanced: advancedModuleDataSchema.optional().default({}),
    utilities: z.preprocess(
        (val) => {
            if (!val || typeof val !== 'object' || Array.isArray(val)) return val;

            const filtered: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(val as Record<string, unknown>)) {
                if (allowedUtilityCategories.has(key)) {
                    filtered[key] = value;
                }
            }
            return filtered;
        },
        z.record(z.string(), submittedSheetEditableUtilitySchema)
            .refine((obj) => Object.keys(obj).length <= UTILITY_CATEGORY_KEYS.length, {
                message: 'Too many utility entries',
            })
    ),
}).strict();
