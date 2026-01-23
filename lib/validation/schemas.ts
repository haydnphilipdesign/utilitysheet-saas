import { z } from 'zod';
import type { UtilityCategory } from '@/types';
import { UTILITY_CATEGORY_KEYS } from '@/lib/constants';
import { BRAND_PROFILE_LIMITS } from '@/lib/branding/limits';

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

const nullToUndefined = (val: unknown) => (val === null ? undefined : val);

const hexColorSchema = z.string().trim().regex(/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/, {
    message: 'Must be a valid hex color (e.g. #10b981)',
});

const optionalLimitedString = (maxLength: number) =>
    z.preprocess(nullToUndefined, z.string().trim().max(maxLength).optional());

const optionalMultilineString = (maxLength: number) =>
    z.preprocess(nullToUndefined, z.string().max(maxLength).optional());

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
    hidden: z.boolean().optional().default(false),
    contact_phone: z.string().trim().max(50).nullable().optional(),
    contact_url: httpUrlSchemaFlexible.optional(),
    extra: z.record(z.string(), z.unknown()).optional(),
}).passthrough(); // Allow extra fields

export const sellerSubmissionBodySchema = z.object({
    water_source: waterSourceEnum,
    sewer_type: sewerTypeEnum,
    heating_type: heatingTypeEnum,
    fuels_present: z.array(heatingFuelEnum).max(4),
    primary_heating_type: heatingFuelEnum.nullable(),
    trash_handled_by: z.enum(['municipal', 'private', 'not_sure']),
    optional_utilities: z.array(z.enum(['trash', 'internet', 'cable'])).optional(),
    utilities: z.preprocess(
        (val) => {
            const input = val;
            if (!input || typeof input !== 'object' || Array.isArray(input)) return input;

            const filtered: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
                if (allowedUtilityCategories.has(k)) {
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
