import type { ProviderEntryMode, UtilityCategory } from '@/types';

type SellerSubmissionLike = {
    water_source?: string | null;
    sewer_type?: string | null;
    primary_heating_type?: string | null;
    heating_type?: string | null;
    packet_mode?: string | null;
    advanced_modules?: unknown;
    advanced_module_exclusions?: unknown;
    advanced?: unknown;
    utilities?: Record<string, ({ entry_mode?: ProviderEntryMode | null; hidden?: boolean } & Record<string, unknown>) | undefined>;
};

const ENTRY_MODES: ProviderEntryMode[] = ['suggested_confirmed', 'search_selected', 'free_text', 'unknown'];

function countAdvancedExclusions(value: unknown): number {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;
    return Object.values(value as Record<string, unknown>).reduce<number>((count, entry) => {
        return count + (Array.isArray(entry) ? entry.length : 0);
    }, 0);
}

export function buildSellerSubmittedEventSummary(payload: SellerSubmissionLike) {
    const utilities = payload.utilities || {};
    const visibleEntries = Object.entries(utilities).filter(([, entry]) => !entry?.hidden);
    const entryModes = Object.fromEntries(ENTRY_MODES.map((mode) => [mode, 0])) as Record<ProviderEntryMode, number>;

    for (const [, entry] of visibleEntries) {
        const mode = entry?.entry_mode || 'unknown';
        entryModes[mode] = (entryModes[mode] || 0) + 1;
    }

    const advancedModules = Array.isArray(payload.advanced_modules)
        ? payload.advanced_modules.filter((item): item is string => typeof item === 'string')
        : [];

    return {
        actor: 'seller',
        packet_mode: payload.packet_mode === 'advanced' ? 'advanced' : 'simple',
        utility_count: visibleEntries.length,
        utility_categories: visibleEntries.map(([category]) => category as UtilityCategory),
        entry_modes: entryModes,
        advanced_module_count: advancedModules.length,
        advanced_modules: advancedModules,
        advanced_exclusion_count: countAdvancedExclusions(payload.advanced_module_exclusions),
        water_source: payload.water_source || null,
        sewer_type: payload.sewer_type || null,
        heating_type: payload.primary_heating_type || payload.heating_type || null,
    };
}
