import type { z } from 'zod';
import type { sellerFormCreateBodySchema } from '@/lib/validation/schemas';
import type { IntakeLink } from '@/lib/neon/queries/intake-links';
import { UTILITY_CATEGORY_KEYS } from '@/lib/constants';
function normalizeIntakeUtilityCategories(value: unknown) {
    const selected = Array.isArray(value)
        ? UTILITY_CATEGORY_KEYS.filter((c) => value.includes(c))
        : [];
    return selected.length ? selected : [...UTILITY_CATEGORY_KEYS];
}
import {
    normalizeAdvancedModuleExclusions,
    normalizeAdvancedModules,
} from '@/lib/packet/modules';

export type SellerFormPatch = Partial<
    Omit<z.infer<typeof sellerFormCreateBodySchema>, 'duplicateFromId'>
>;

export function formConfiguration(form: IntakeLink): SellerFormPatch {
    const advancedModules = normalizeAdvancedModules(form.advanced_modules);
    return {
        name: form.name || 'My seller form',
        sellerHeading: form.seller_heading || null,
        sellerIntro: form.seller_intro || null,
        isActive: form.is_active,
        defaultBrandProfileId: form.default_brand_profile_id || null,
        defaultUtilityCategories: normalizeIntakeUtilityCategories(
            form.default_utility_categories,
        ),
        defaultPacketMode: form.default_packet_mode,
        advancedModules,
        advancedModuleExclusions: normalizeAdvancedModuleExclusions(
            form.advanced_module_exclusions,
            advancedModules,
        ),
        collectHoaQuestions: form.collect_hoa_questions,
        collectElectricMeterNumber: form.collect_electric_meter_number,
    };
}

export function formRequestFields(form: IntakeLink, isPaid: boolean) {
    const packetMode =
        isPaid && form.default_packet_mode === 'advanced'
            ? ('advanced' as const)
            : ('simple' as const);
    const advancedModules =
        packetMode === 'advanced'
            ? normalizeAdvancedModules(form.advanced_modules)
            : [];
    return {
        utilityCategories: normalizeIntakeUtilityCategories(
            form.default_utility_categories,
        ),
        packetMode,
        advancedModules,
        advancedModuleExclusions:
            packetMode === 'advanced'
                ? normalizeAdvancedModuleExclusions(
                      form.advanced_module_exclusions,
                      advancedModules,
                  )
                : {},
        collectHoaQuestions: form.collect_hoa_questions,
        collectElectricMeterNumber: form.collect_electric_meter_number,
        sourceFormId: form.id,
        sourceFormRevision: form.revision,
        sellerIntro: form.seller_intro,
    };
}

/** Operational rollout controls; commercial allowances are enforced separately. */
export function sellerFormCreationCapability(accountId: string) {
    const enabled = process.env.SAVED_SELLER_FORMS_ENABLED === 'true';
    const allUsers = process.env.SAVED_SELLER_FORMS_ROLLOUT === 'all';
    const pilotIds = (process.env.SAVED_SELLER_FORMS_PILOT_ACCOUNT_IDS || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    const configuredCap = Number(process.env.SAVED_SELLER_FORMS_TECHNICAL_CAP);
    const technicalCap =
        Number.isSafeInteger(configuredCap) &&
        configuredCap > 0 &&
        configuredCap <= 2147483647
            ? configuredCap
            : null;
    return {
        canCreate:
            enabled && (allUsers || pilotIds.includes(accountId)) && technicalCap !== null,
        technicalCap,
        reason: 'pilot' as const,
    };
}

export function normalizeFormPatch(
    patch: SellerFormPatch,
    current?: IntakeLink,
): SellerFormPatch {
    const result = { ...patch };
    if (
        patch.advancedModules !== undefined ||
        patch.advancedModuleExclusions !== undefined
    ) {
        const modules = normalizeAdvancedModules(
            patch.advancedModules ?? current?.advanced_modules,
        );
        result.advancedModules = modules;
        result.advancedModuleExclusions = normalizeAdvancedModuleExclusions(
            patch.advancedModuleExclusions ??
                current?.advanced_module_exclusions,
            modules,
        );
    }
    return result;
}
