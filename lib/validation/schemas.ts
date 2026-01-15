import { z } from 'zod';
import type { UtilityCategory } from '@/types';
import { UTILITY_CATEGORY_KEYS } from '@/lib/constants';

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
