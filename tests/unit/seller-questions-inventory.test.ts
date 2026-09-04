import { describe, expect, it } from 'vitest';
import {
    ADVANCED_MODULE_FIELD_KEYS,
    ADVANCED_MODULE_KEYS,
    PACKET_MODE_LABELS,
} from '@/lib/packet/modules';
import { UTILITY_CATEGORIES } from '@/lib/constants';
import {
    UTILITY_PROVIDER_HELPERS,
    countSellerQuestions,
    getIncludedSellerQuestionKeys,
    getSellerQuestionInventory,
    getSellerQuestionPreview,
    getUtilityProviderPrompt,
    searchSellerQuestionSections,
    type SellerQuestionConfiguration,
} from '@/lib/packet/seller-questions';

const HANDOFF_FIELD_TOTAL = ADVANCED_MODULE_KEYS.reduce(
    (total, moduleKey) => total + ADVANCED_MODULE_FIELD_KEYS[moduleKey].length,
    0
);

function config(overrides: Partial<SellerQuestionConfiguration> = {}): SellerQuestionConfiguration {
    return {
        packetMode: 'simple',
        utilityCategories: UTILITY_CATEGORIES.map((category) => category.key),
        advancedModules: [...ADVANCED_MODULE_KEYS],
        advancedModuleExclusions: {},
        ...overrides,
    };
}

describe('packet mode naming', () => {
    it('keeps the internal enum values while renaming the customer-facing label', () => {
        expect(PACKET_MODE_LABELS.simple).toBe('Simple Utility Sheet');
        expect(PACKET_MODE_LABELS.advanced).toBe('Property Handoff Packet');
    });
});

describe('getSellerQuestionInventory', () => {
    it('covers home basics, every utility category, and every handoff module', () => {
        const sections = getSellerQuestionInventory();

        expect(sections.filter((section) => section.group === 'home_basics')).toHaveLength(1);
        expect(sections.filter((section) => section.group === 'utilities')).toHaveLength(
            UTILITY_CATEGORIES.length
        );
        expect(sections.filter((section) => section.group === 'handoff')).toHaveLength(
            ADVANCED_MODULE_KEYS.length
        );
    });

    it('lists all 33 built-in handoff questions', () => {
        const handoffQuestions = getSellerQuestionInventory()
            .filter((section) => section.group === 'handoff')
            .flatMap((section) => section.questions);

        expect(HANDOFF_FIELD_TOTAL).toBe(33);
        expect(handoffQuestions).toHaveLength(HANDOFF_FIELD_TOTAL);
    });

    it('uses the same prompt strings the seller form renders', () => {
        const electric = getSellerQuestionInventory().find((section) => section.key === 'utility.electric');

        expect(electric?.questions[0].sellerPrompt).toBe(getUtilityProviderPrompt('electric', 'Electric'));
        expect(electric?.questions[0].helper).toBe(UTILITY_PROVIDER_HELPERS.electric);
    });

    it('gives every question a unique key', () => {
        const keys = getSellerQuestionInventory().flatMap((section) =>
            section.questions.map((question) => question.key)
        );

        expect(new Set(keys).size).toBe(keys.length);
    });
});

describe('getSellerQuestionPreview', () => {
    it('omits handoff sections in Simple Utility Sheet mode', () => {
        const sections = getSellerQuestionPreview(config({ packetMode: 'simple' }));

        expect(sections.some((section) => section.group === 'handoff')).toBe(false);
    });

    it('includes handoff sections in Property Handoff Packet mode', () => {
        const sections = getSellerQuestionPreview(config({ packetMode: 'advanced' }));

        expect(sections.filter((section) => section.group === 'handoff')).toHaveLength(
            ADVANCED_MODULE_KEYS.length
        );
    });

    it('drops questions excluded for the current configuration', () => {
        const sections = getSellerQuestionPreview(
            config({
                packetMode: 'advanced',
                advancedModuleExclusions: { mailbox_access: ['garage_door_code'] },
            })
        );
        const mailbox = sections.find((section) => section.key === 'handoff.mailbox_access');

        expect(mailbox).toBeDefined();
        expect(mailbox?.questions.some((question) => question.label === 'Garage Door Code')).toBe(false);
        expect(mailbox?.questions.some((question) => question.label === 'Mailbox Location')).toBe(true);
    });

    it('drops a module whose questions are all excluded, matching the seller wizard', () => {
        const sections = getSellerQuestionPreview(
            config({
                packetMode: 'advanced',
                advancedModuleExclusions: {
                    smart_home_security: [...ADVANCED_MODULE_FIELD_KEYS.smart_home_security],
                },
            })
        );

        expect(sections.some((section) => section.key === 'handoff.smart_home_security')).toBe(false);
    });

    it('only previews enabled handoff modules', () => {
        const sections = getSellerQuestionPreview(
            config({ packetMode: 'advanced', advancedModules: ['service_providers'] })
        );

        expect(sections.filter((section) => section.group === 'handoff').map((section) => section.key)).toEqual([
            'handoff.service_providers',
        ]);
    });

    it('always previews Electric, because the seller wizard always shows it', () => {
        const sections = getSellerQuestionPreview(config({ utilityCategories: ['water'] }));

        expect(sections.map((section) => section.key)).toContain('utility.electric');
        expect(sections.map((section) => section.key)).toContain('utility.water');
        expect(sections.map((section) => section.key)).not.toContain('utility.cable');
    });

    it('states the condition for every utility section the seller may not reach', () => {
        const sections = getSellerQuestionPreview(config());
        const byKey = (key: string) => sections.find((section) => section.key === key);

        expect(byKey('utility.electric')?.condition).toContain('Always asked');
        expect(byKey('utility.water')?.condition).toContain('Public Water');
        expect(byKey('utility.sewer')?.condition).toContain('Public Sewer');
        expect(byKey('utility.gas')?.condition).toContain('Natural Gas');
        expect(byKey('utility.propane')?.condition).toContain('Propane');
        expect(byKey('utility.oil')?.condition).toContain('Heating Oil');
        expect(byKey('utility.trash')?.condition).toContain('Trash & Recycling');
        expect(byKey('utility.internet')?.condition).toContain('Internet');
        expect(byKey('utility.cable')?.condition).toContain('Cable/TV');
    });

    it('states the condition for conditional home basics questions', () => {
        const homeBasics = getSellerQuestionPreview(config()).find(
            (section) => section.key === 'home_basics'
        );
        const byKey = (key: string) => homeBasics?.questions.find((question) => question.key === key);

        expect(homeBasics?.condition).toBeUndefined();
        expect(byKey('home_basics.water_source')?.condition).toBeUndefined();
        expect(byKey('home_basics.primary_heating_type')?.condition).toContain('more than one fuel source');
        expect(byKey('home_basics.optional_utilities')?.condition).toContain('Trash & Recycling');
    });

    it('honors the electric meter preference', () => {
        const withMeter = getSellerQuestionPreview(config({ collectElectricMeterNumber: true }));
        const withoutMeter = getSellerQuestionPreview(config({ collectElectricMeterNumber: false }));

        const hasMeterQuestion = (sections: ReturnType<typeof getSellerQuestionPreview>) =>
            sections
                .find((section) => section.key === 'utility.electric')
                ?.questions.some((question) => question.key === 'utility.electric.meter_number') ?? false;

        expect(hasMeterQuestion(withMeter)).toBe(true);
        expect(hasMeterQuestion(withoutMeter)).toBe(false);
    });

    it('defaults the electric meter preference to on, matching the server default', () => {
        const sections = getSellerQuestionPreview(config());

        expect(
            sections
                .find((section) => section.key === 'utility.electric')
                ?.questions.some((question) => question.key === 'utility.electric.meter_number')
        ).toBe(true);
    });
});

describe('getIncludedSellerQuestionKeys', () => {
    it('marks an excluded handoff question as not included', () => {
        const included = getIncludedSellerQuestionKeys(
            config({
                packetMode: 'advanced',
                advancedModuleExclusions: { mailbox_access: ['garage_door_code'] },
            })
        );

        expect(included.has('handoff.mailbox_access.garage_door_code')).toBe(false);
        expect(included.has('handoff.mailbox_access.mailbox_location')).toBe(true);
    });

    it('marks every handoff question as not included in Simple mode', () => {
        const included = getIncludedSellerQuestionKeys(config({ packetMode: 'simple' }));

        expect(included.has('handoff.service_providers.hvac_provider_name')).toBe(false);
        expect(included.has('utility.electric.provider')).toBe(true);
    });
});

describe('searchSellerQuestionSections', () => {
    const inventory = getSellerQuestionInventory();

    it('returns everything for an empty query', () => {
        expect(searchSellerQuestionSections(inventory, '   ')).toEqual(inventory);
    });

    it('finds a question by label, case-insensitively', () => {
        const results = searchSellerQuestionSections(inventory, 'garage');

        expect(countSellerQuestions(results)).toBeGreaterThan(0);
        expect(
            results.flatMap((section) => section.questions).every((question) =>
                `${question.label} ${question.sellerPrompt} ${question.helper || ''} ${question.example || ''}`
                    .toLowerCase()
                    .includes('garage')
            )
        ).toBe(true);
    });

    it('finds a question by its seller-facing prompt', () => {
        const results = searchSellerQuestionSections(inventory, 'who services the pool');

        expect(results.flatMap((section) => section.questions).map((question) => question.label)).toContain(
            'Pool Service Provider'
        );
    });

    it('finds a question by its example value', () => {
        const results = searchSellerQuestionSections(inventory, 'ADT');

        expect(results.flatMap((section) => section.questions).map((question) => question.label)).toContain(
            'Security System Brand'
        );
    });

    it('keeps a whole section when the section title matches', () => {
        const results = searchSellerQuestionSections(inventory, 'Home Service Contacts');
        const section = results.find((candidate) => candidate.key === 'handoff.service_providers');

        expect(section?.questions).toHaveLength(ADVANCED_MODULE_FIELD_KEYS.service_providers.length);
    });

    it('returns nothing for a term the product does not collect', () => {
        expect(searchSellerQuestionSections(inventory, 'front door code')).toEqual([]);
    });
});
