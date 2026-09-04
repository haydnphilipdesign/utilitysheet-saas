import { UTILITY_CATEGORIES } from '@/lib/constants';
import {
    ADVANCED_MODULE_FIELD_METADATA,
    ADVANCED_MODULE_KEYS,
    ADVANCED_MODULE_METADATA,
    getAdvancedModuleVisibleFieldKeys,
    getEffectiveAdvancedModules,
} from '@/lib/packet/modules';
import type {
    AdvancedModuleExclusions,
    AdvancedModuleKey,
    PacketMode,
    SewerType,
    UtilityCategory,
    WaterSource,
} from '@/types';

/*
 * Single source of truth for every built-in question a seller can be asked.
 *
 * The handoff questions come from ADVANCED_MODULE_FIELD_METADATA. The core
 * Home Basics and utility prompts are declared here and imported by
 * components/seller-form/steps/HomeBasicsStep.tsx and
 * components/seller-form/steps/UtilityStep.tsx, so the seller form and the
 * in-product question inventory cannot drift apart.
 */

// ─── Core Home Basics options (rendered by HomeBasicsStep) ───────────────────

export interface SellerChoiceOption<TValue extends string = string> {
    id: TValue;
    label: string;
    hint?: string;
}

export const WATER_SOURCE_OPTIONS: SellerChoiceOption<WaterSource>[] = [
    { id: 'city', label: 'Public Water', hint: "We'll ask the provider name next" },
    { id: 'well', label: 'Private Well' },
    { id: 'hoa', label: 'HOA / Condo' },
    { id: 'not_sure', label: 'Not Sure' },
];

export const SEWER_TYPE_OPTIONS: SellerChoiceOption<SewerType>[] = [
    { id: 'public', label: 'Public Sewer', hint: "We'll ask the authority next" },
    { id: 'septic', label: 'Septic System' },
    { id: 'hoa', label: 'HOA / Condo' },
    { id: 'not_sure', label: 'Not Sure' },
];

export const FUEL_SOURCE_OPTIONS: SellerChoiceOption[] = [
    { id: 'natural_gas', label: 'Natural Gas' },
    { id: 'propane', label: 'Propane' },
    { id: 'oil', label: 'Heating Oil' },
    { id: 'electric', label: 'Electric' },
];

export function getFuelSourceLabel(fuelId: string): string {
    return FUEL_SOURCE_OPTIONS.find((option) => option.id === fuelId)?.label || fuelId;
}

/** Utility categories the seller opts into on Home Basics rather than always seeing. */
export const OPTIONAL_UTILITY_CATEGORIES: UtilityCategory[] = ['trash', 'internet', 'cable'];

/** Fuel selections that unlock a heating-provider utility step. */
export const FUEL_UTILITY_CATEGORY_BY_FUEL: Record<string, UtilityCategory> = {
    natural_gas: 'gas',
    propane: 'propane',
    oil: 'oil',
};

// ─── Core utility prompts (rendered by UtilityStep) ──────────────────────────

export const UTILITY_PROVIDER_PROMPTS: Partial<Record<UtilityCategory, string>> = {
    electric: 'Who provides electricity for this home?',
    water: 'Who provides water service to this home?',
    sewer: 'Which authority handles wastewater service for this home?',
    gas: 'Who supplies natural gas to this home?',
    propane: 'Who delivers propane to this home?',
    oil: 'Who delivers heating oil to this home?',
    trash: 'Who handles trash and recycling pickup?',
    internet: 'Who provides internet service to this home?',
    cable: 'Who provides cable or TV service to this home?',
};

export const UTILITY_PROVIDER_HELPERS: Partial<Record<UtilityCategory, string>> = {
    water: "Usually a city utility or water district. Check a recent water bill if you're not sure.",
    sewer: "Often the city, county, or a separate sewer authority. Check a recent bill or your county's website.",
    electric: 'Listed on your monthly electric bill.',
    gas: 'Listed on your monthly gas bill.',
    propane: 'The company that fills your propane tank.',
    oil: 'The company that delivers heating oil.',
    trash: 'Could be the city, the county, or a private hauler.',
    internet: 'Like Xfinity, Spectrum, AT&T Fiber, etc.',
    cable: 'Like Xfinity, Spectrum, DirecTV, etc.',
};

export function getUtilityProviderPrompt(category: UtilityCategory, categoryLabel: string): string {
    return UTILITY_PROVIDER_PROMPTS[category] || `Who provides your ${categoryLabel.toLowerCase()}?`;
}

const UTILITY_CATEGORY_LABELS: Record<UtilityCategory, string> = Object.fromEntries(
    UTILITY_CATEGORIES.map((category) => [category.key, category.label])
) as Record<UtilityCategory, string>;

// ─── Inventory shape ─────────────────────────────────────────────────────────

export type SellerQuestionGroup = 'home_basics' | 'utilities' | 'handoff';

export interface SellerQuestion {
    /** Unique within the inventory. Not a database column. */
    key: string;
    label: string;
    /** The wording the seller actually sees. */
    sellerPrompt: string;
    helper?: string;
    example?: string;
    /** Answer choices, when the question is a fixed set rather than free text. */
    choices?: string[];
    /**
     * When present, the seller only reaches this question in some runs. Stated
     * plainly so the preview never over-promises.
     */
    condition?: string;
}

export interface SellerQuestionSection {
    key: string;
    group: SellerQuestionGroup;
    title: string;
    description: string;
    /** The handoff module this section maps to, when it is a handoff section. */
    moduleKey?: AdvancedModuleKey;
    /** Utility category this section maps to, when it is a utility section. */
    utilityCategory?: UtilityCategory;
    /** True when the section is only asked in Property Handoff Packet mode. */
    handoffOnly: boolean;
    /**
     * When present, the seller only reaches this whole section in some runs.
     * Mirrors the visibility rules in components/seller-form/SellerWizard.tsx.
     */
    condition?: string;
    questions: SellerQuestion[];
}

export interface SellerQuestionConfiguration {
    packetMode: PacketMode;
    utilityCategories: UtilityCategory[];
    advancedModules: AdvancedModuleKey[];
    advancedModuleExclusions?: AdvancedModuleExclusions | null;
    /** Defaults to true, matching the server-side `!== false` default. */
    collectElectricMeterNumber?: boolean;
}

// ─── Section builders ────────────────────────────────────────────────────────

function buildHomeBasicsSection(): SellerQuestionSection {
    return {
        key: 'home_basics',
        group: 'home_basics',
        title: 'Home Basics',
        description: 'Asked first, on every seller form. The answers decide which utility sections follow.',
        handoffOnly: false,
        questions: [
            {
                key: 'home_basics.water_source',
                label: 'Water Source',
                sellerPrompt: 'Water Source',
                helper: 'Public water leads to a water provider question.',
                choices: WATER_SOURCE_OPTIONS.map((option) => option.label),
            },
            {
                key: 'home_basics.sewer_type',
                label: 'Sewer Type',
                sellerPrompt: 'Sewer Type',
                helper: 'Public sewer leads to a wastewater authority question.',
                choices: SEWER_TYPE_OPTIONS.map((option) => option.label),
            },
            {
                key: 'home_basics.fuels_present',
                label: 'Fuel Sources',
                sellerPrompt: 'Fuel Sources',
                helper: 'Select all that apply to your home.',
                choices: FUEL_SOURCE_OPTIONS.map((option) => option.label),
            },
            {
                key: 'home_basics.primary_heating_type',
                label: 'Primary Heat Source',
                sellerPrompt: 'Which is the primary heat source?',
                helper: 'This determines which heating provider we ask about next.',
                condition: 'Asked only when the seller selects more than one fuel source.',
                choices: FUEL_SOURCE_OPTIONS.map((option) => option.label),
            },
            {
                key: 'home_basics.optional_utilities',
                label: 'Optional Utilities',
                sellerPrompt: 'Do you have these utilities?',
                helper: "Choose any that apply. We'll only ask about utilities you have.",
                condition: 'Asked only when Trash & Recycling, Internet, or Cable/TV is included.',
                choices: OPTIONAL_UTILITY_CATEGORIES.map((category) => UTILITY_CATEGORY_LABELS[category]),
            },
        ],
    };
}

function getUtilityCondition(category: UtilityCategory): string | undefined {
    if (category === 'electric') {
        return 'Always asked, on every seller form.';
    }
    if (category === 'water') {
        return 'Asked when the seller answers Public Water on Home Basics.';
    }
    if (category === 'sewer') {
        return 'Asked when the seller answers Public Sewer on Home Basics.';
    }
    if (category === 'gas') {
        return 'Asked when the seller selects Natural Gas on Home Basics.';
    }
    if (category === 'propane') {
        return 'Asked when the seller selects Propane on Home Basics.';
    }
    if (category === 'oil') {
        return 'Asked when the seller selects Heating Oil on Home Basics.';
    }
    if (OPTIONAL_UTILITY_CATEGORIES.includes(category)) {
        return `Asked when the seller confirms the home has ${UTILITY_CATEGORY_LABELS[category]}.`;
    }
    return undefined;
}

function buildUtilitySection(
    category: UtilityCategory,
    collectElectricMeterNumber: boolean
): SellerQuestionSection {
    const label = UTILITY_CATEGORY_LABELS[category];
    const questions: SellerQuestion[] = [
        {
            key: `utility.${category}.provider`,
            label: `${label} Provider`,
            sellerPrompt: getUtilityProviderPrompt(category, label),
            helper: UTILITY_PROVIDER_HELPERS[category],
        },
    ];

    if (category === 'electric' && collectElectricMeterNumber) {
        questions.push({
            key: 'utility.electric.meter_number',
            label: 'Meter Number',
            sellerPrompt: 'Meter Number (optional)',
            helper: 'If available, this will be added to the final PDF.',
            condition: 'Shown while "Collect electric meter number" is on in Settings.',
        });
    }

    if (category === 'trash') {
        questions.push(
            {
                key: 'utility.trash.pickup_days',
                label: 'Trash Pickup Days',
                sellerPrompt: 'Which days is trash picked up?',
                helper: 'Pick all that apply. "Not sure" is fine.',
            },
            {
                key: 'utility.trash.has_recycling',
                label: 'Recycling Pickup',
                sellerPrompt: 'Is there recycling pickup at this home?',
                helper: 'Optional. This helps the buyer plan ahead.',
                choices: ['Yes', 'No', 'Not sure'],
            },
            {
                key: 'utility.trash.recycling_pickup_days',
                label: 'Recycling Pickup Days',
                sellerPrompt: 'Recycling pickup days',
                condition: 'Asked when the seller answers Yes or Not sure to recycling pickup.',
            }
        );
    }

    return {
        key: `utility.${category}`,
        group: 'utilities',
        title: label,
        description: `Provider details for ${label.toLowerCase()}.`,
        utilityCategory: category,
        handoffOnly: false,
        condition: getUtilityCondition(category),
        questions,
    };
}

function buildHandoffSection(
    moduleKey: AdvancedModuleKey,
    fieldKeys?: string[]
): SellerQuestionSection {
    const moduleMeta = ADVANCED_MODULE_METADATA[moduleKey];
    const allowed = fieldKeys ? new Set(fieldKeys) : null;

    return {
        key: `handoff.${moduleKey}`,
        group: 'handoff',
        title: moduleMeta.label,
        description: moduleMeta.summary,
        moduleKey,
        handoffOnly: true,
        questions: ADVANCED_MODULE_FIELD_METADATA[moduleKey]
            .filter((field) => !allowed || allowed.has(field.key))
            .map((field) => ({
                key: `handoff.${moduleKey}.${field.key}`,
                label: field.label,
                sellerPrompt: field.sellerPrompt,
                example: field.example,
            })),
    };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Every built-in seller question, regardless of configuration. Utility sections
 * cover all supported categories and handoff sections cover all five modules, so
 * this is the complete answer to "can UtilitySheet collect X?".
 */
export function getSellerQuestionInventory(): SellerQuestionSection[] {
    return [
        buildHomeBasicsSection(),
        ...UTILITY_CATEGORIES.map((category) => buildUtilitySection(category.key, true)),
        ...ADVANCED_MODULE_KEYS.map((moduleKey) => buildHandoffSection(moduleKey)),
    ];
}

/**
 * The sections a seller will actually be asked under `config`.
 *
 * The utility rules mirror the visibility effect in
 * components/seller-form/SellerWizard.tsx. Electric is always included because
 * the wizard always shows it. Both places must change together.
 */
export function getSellerQuestionPreview(config: SellerQuestionConfiguration): SellerQuestionSection[] {
    const collectElectricMeterNumber = config.collectElectricMeterNumber !== false;
    const requested = new Set<UtilityCategory>(config.utilityCategories);
    const previewedCategories = UTILITY_CATEGORIES
        .map((category) => category.key)
        .filter((category) => category === 'electric' || requested.has(category));

    const sections: SellerQuestionSection[] = [
        buildHomeBasicsSection(),
        ...previewedCategories.map((category) => buildUtilitySection(category, collectElectricMeterNumber)),
    ];

    if (config.packetMode !== 'advanced') {
        return sections;
    }

    const effectiveModules = getEffectiveAdvancedModules(
        config.advancedModules,
        config.advancedModuleExclusions
    );

    for (const moduleKey of effectiveModules) {
        sections.push(
            buildHandoffSection(
                moduleKey,
                getAdvancedModuleVisibleFieldKeys(moduleKey, config.advancedModuleExclusions)
            )
        );
    }

    return sections;
}

/** The set of question keys included under `config`, for marking the full inventory. */
export function getIncludedSellerQuestionKeys(config: SellerQuestionConfiguration): Set<string> {
    const included = new Set<string>();
    for (const section of getSellerQuestionPreview(config)) {
        for (const question of section.questions) {
            included.add(question.key);
        }
    }
    return included;
}

/** Total number of questions a seller could be asked under `config`. */
export function countSellerQuestions(sections: SellerQuestionSection[]): number {
    return sections.reduce((total, section) => total + section.questions.length, 0);
}

/**
 * Case-insensitive search across section titles, question labels, prompts,
 * helpers, examples, and answer choices.
 */
export function searchSellerQuestionSections(
    sections: SellerQuestionSection[],
    query: string
): SellerQuestionSection[] {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sections;

    return sections
        .map((section) => {
            const sectionMatches = `${section.title} ${section.description} ${section.condition || ''}`
                .toLowerCase()
                .includes(normalized);
            const questions = section.questions.filter((question) => {
                const haystack = [
                    question.label,
                    question.sellerPrompt,
                    question.helper || '',
                    question.example || '',
                    (question.choices || []).join(' '),
                    question.condition || '',
                ]
                    .join(' ')
                    .toLowerCase();
                return haystack.includes(normalized);
            });

            if (questions.length > 0) return { ...section, questions };
            if (sectionMatches) return section;
            return null;
        })
        .filter((section): section is SellerQuestionSection => section !== null);
}
