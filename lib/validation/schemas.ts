import { z } from 'zod';
import type { UtilityCategory } from '@/types';
import { UTILITY_CATEGORY_KEYS } from '@/lib/constants';

export const utilityCategoryEnum = z.enum(
    UTILITY_CATEGORY_KEYS as [UtilityCategory, ...UtilityCategory[]]
);

const isHttpUrl = (value: string) => value.startsWith('https://') || value.startsWith('http://');

export const createRequestBodySchema = z.object({
    propertyAddress: z.string().trim().min(5).max(200),
    sellerName: z.string().trim().min(1).max(120).optional(),
    sellerEmail: z.string().trim().email().optional(),
    sellerPhone: z.string().trim().min(1).max(30).optional(),
    closingDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    utilityCategories: z.array(utilityCategoryEnum).min(1).max(UTILITY_CATEGORY_KEYS.length).optional(),
    brandProfileId: z.string().uuid().optional(),
    sendSellerEmail: z.boolean().optional(),
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

const httpUrlSchema = z
    .string()
    .trim()
    .url()
    .refine(isHttpUrl, { message: 'Must be an http(s) URL' });

const utilityWizardStateSchema = z.object({
    entry_mode: providerEntryModeEnum.nullable(),
    display_name: z.string().trim().max(200).nullable(),
    raw_text: z.string().trim().max(500).nullable(),
    hidden: z.boolean().optional().default(false),
    contact_phone: z.string().trim().max(50).nullable().optional(),
    contact_url: z.union([httpUrlSchema, z.null()]).optional(),
    extra: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const sellerSubmissionBodySchema = z.object({
    water_source: waterSourceEnum,
    sewer_type: sewerTypeEnum,
    heating_type: heatingTypeEnum,
    fuels_present: z.array(heatingFuelEnum).max(4),
    primary_heating_type: heatingFuelEnum.nullable(),
    trash_handled_by: z.enum(['municipal', 'private', 'not_sure']),
    optional_utilities: z.array(z.enum(['trash', 'internet', 'cable'])).optional(),
    utilities: z
        .record(utilityCategoryEnum, utilityWizardStateSchema)
        .refine((obj) => Object.keys(obj).length <= UTILITY_CATEGORY_KEYS.length, {
            message: 'Too many utility entries',
        }),
}).strict();
