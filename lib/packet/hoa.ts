import type { HasHoa, HoaAnswers, HoaDuesFrequency } from '@/types';

/*
 * The HOA / condo association question group on Home Basics.
 *
 * `has_hoa` is association membership. It is unrelated to the `hoa` option on
 * water source and sewer type, which means the association bills that utility.
 *
 * Everything that asks, stores, edits, or prints these answers reads the
 * declarations here, so the seller form, the submitted-sheet editor, the packet
 * web page, and the PDF cannot drift apart. This module has no imports beyond
 * types so validation and query code can depend on it freely.
 */

export const HOA_GATE_LABEL = 'HOA / Condo Association';
export const HOA_GATE_PROMPT = 'Is this home part of an HOA or condo association?';
export const HOA_SECTION_TITLE = 'HOA / Condo Association Details';
export const HOA_DETAILS_CONDITION = 'Asked only when the seller answers Yes to the HOA question.';
export const HOA_GATE_CONDITION = 'Shown while "Ask about HOA or condo association" is on in Settings.';

/**
 * The account preference behind the Settings switch. It lives beside
 * `collect_electric_meter_number` in `accounts.notification_preferences`, is on
 * unless explicitly false, and is available on every plan.
 *
 * It controls asking only. Answers already collected stay on the packet and
 * stay editable; turning the switch off never deletes anything.
 */
export const COLLECT_HOA_QUESTIONS_PREFERENCE = 'collect_hoa_questions';

export function collectsHoaQuestions(preferences: unknown): boolean {
    if (!preferences || typeof preferences !== 'object') return true;
    return (preferences as Record<string, unknown>)[COLLECT_HOA_QUESTIONS_PREFERENCE] !== false;
}

export const HAS_HOA_OPTIONS: Array<{ id: HasHoa; label: string }> = [
    { id: 'yes', label: 'Yes' },
    { id: 'no', label: 'No' },
    { id: 'not_sure', label: 'Not Sure' },
];

export const HOA_DUES_FREQUENCY_OPTIONS: Array<{ id: HoaDuesFrequency; label: string; per: string }> = [
    { id: 'monthly', label: 'Monthly', per: 'per month' },
    { id: 'quarterly', label: 'Quarterly', per: 'per quarter' },
    { id: 'yearly', label: 'Yearly', per: 'per year' },
];

export type HoaTextFieldKey =
    | 'hoa_name'
    | 'hoa_management_company'
    | 'hoa_management_contact'
    | 'hoa_management_phone'
    | 'hoa_management_email'
    | 'hoa_dues_amount'
    | 'hoa_portal_or_payment';

export interface HoaTextField {
    key: HoaTextFieldKey;
    /** Short label used on the form field, the editor, and the packet. */
    label: string;
    /** The question as the seller question inventory describes it. */
    sellerPrompt: string;
    example: string;
    helper?: string;
    maxLength: number;
    inputType: 'text' | 'tel' | 'email';
}

/**
 * The free-text HOA answers, in the order the seller is asked and the packet
 * prints them. `hoa_dues_frequency` is a choice, not text, and is paired with
 * `hoa_dues_amount` wherever the two are shown.
 */
export const HOA_TEXT_FIELDS: HoaTextField[] = [
    {
        key: 'hoa_name',
        label: 'Association Name',
        sellerPrompt: 'What is the association called?',
        example: 'Lakeview Commons HOA',
        maxLength: 120,
        inputType: 'text',
    },
    {
        key: 'hoa_management_company',
        label: 'Management Company',
        sellerPrompt: 'Who manages the association?',
        example: 'Crest Property Management',
        helper: 'Leave blank if the association manages itself.',
        maxLength: 120,
        inputType: 'text',
    },
    {
        key: 'hoa_management_contact',
        label: 'Contact Name',
        sellerPrompt: 'Who is the contact person?',
        example: 'Jordan Lee',
        maxLength: 120,
        inputType: 'text',
    },
    {
        key: 'hoa_management_phone',
        label: 'Contact Phone',
        sellerPrompt: 'What is the contact phone number?',
        example: '(555) 204-8890',
        maxLength: 40,
        inputType: 'tel',
    },
    {
        key: 'hoa_management_email',
        label: 'Contact Email',
        sellerPrompt: 'What is the contact email?',
        example: 'office@example.com',
        maxLength: 120,
        inputType: 'email',
    },
    {
        key: 'hoa_dues_amount',
        label: 'Dues',
        sellerPrompt: 'How much are the dues?',
        example: '$240',
        maxLength: 40,
        inputType: 'text',
    },
    {
        key: 'hoa_portal_or_payment',
        label: 'Payments & Documents',
        sellerPrompt: 'Where are dues paid or documents found?',
        example: 'Resident portal at example.com',
        // Free text on a link-addressed form that prints on the buyer-facing
        // packet. The warning is a real mitigation, not decoration.
        helper: "A website or office name is perfect. Please don't enter passwords or account numbers.",
        maxLength: 300,
        inputType: 'text',
    },
];

export const HOA_ANSWER_KEYS: Array<keyof HoaAnswers> = [
    'has_hoa',
    'hoa_name',
    'hoa_management_company',
    'hoa_management_contact',
    'hoa_management_phone',
    'hoa_management_email',
    'hoa_dues_amount',
    'hoa_dues_frequency',
    'hoa_portal_or_payment',
];

export function createEmptyHoaAnswers(): HoaAnswers {
    return {
        has_hoa: null,
        hoa_name: null,
        hoa_management_company: null,
        hoa_management_contact: null,
        hoa_management_phone: null,
        hoa_management_email: null,
        hoa_dues_amount: null,
        hoa_dues_frequency: null,
        hoa_portal_or_payment: null,
    };
}

function readChoice<TValue extends string>(options: Array<{ id: TValue }>, value: unknown): TValue | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    return options.find((option) => option.id === normalized)?.id ?? null;
}

function readText(value: unknown, maxLength: number): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, maxLength) : null;
}

/**
 * The stored shape of the HOA answers in `source`, which may be a database
 * row, a validated request body, or wizard state. Unknown choices become null,
 * text is trimmed, and the detail fields are dropped unless the answer is Yes,
 * so a seller who changes Yes to No cannot leave stale details behind.
 */
export function normalizeHoaAnswers(source: Partial<Record<keyof HoaAnswers, unknown>> | null | undefined): HoaAnswers {
    const answers = createEmptyHoaAnswers();
    if (!source) return answers;

    answers.has_hoa = readChoice(HAS_HOA_OPTIONS, source.has_hoa);
    if (answers.has_hoa !== 'yes') return answers;

    for (const field of HOA_TEXT_FIELDS) {
        answers[field.key] = readText(source[field.key], field.maxLength);
    }
    answers.hoa_dues_frequency = readChoice(HOA_DUES_FREQUENCY_OPTIONS, source.hoa_dues_frequency);

    return answers;
}

/**
 * What a seller submission should write. Nothing is written, and the stored
 * answers are left alone, when the account has the HOA questions turned off or
 * when the form predates them and sent no `has_hoa` key.
 */
export function resolveHoaSubmission(
    body: Partial<Record<keyof HoaAnswers, unknown>>,
    collectHoaQuestions: boolean
): { update: boolean; answers: HoaAnswers } {
    const update = collectHoaQuestions && body.has_hoa !== undefined;
    return { update, answers: update ? normalizeHoaAnswers(body) : createEmptyHoaAnswers() };
}

export function getHasHoaLabel(value: string): string {
    return HAS_HOA_OPTIONS.find((option) => option.id === value)?.label || value.replaceAll('_', ' ');
}

/** "$240 per quarter", the amount alone, or the period alone when no amount was given. */
export function formatHoaDues(amount: string | null | undefined, frequency: string | null | undefined): string {
    const trimmedAmount = (amount || '').trim();
    const option = HOA_DUES_FREQUENCY_OPTIONS.find((candidate) => candidate.id === frequency);
    if (trimmedAmount && option) return `${trimmedAmount} ${option.per}`;
    if (trimmedAmount) return trimmedAmount;
    return option ? `Billed ${option.label.toLowerCase()}` : '';
}

export interface HoaDetailRow {
    key: HoaTextFieldKey;
    label: string;
    value: string;
}

/**
 * The association detail rows a packet displays: nothing unless the seller
 * answered Yes, and only the fields they filled in. The PDF and the public
 * packet page both render from this.
 */
export function getHoaDetailRows(source: Partial<Record<keyof HoaAnswers, unknown>> | null | undefined): HoaDetailRow[] {
    const answers = normalizeHoaAnswers(source);
    if (answers.has_hoa !== 'yes') return [];

    return HOA_TEXT_FIELDS
        .map((field) => ({
            key: field.key,
            label: field.label,
            value: field.key === 'hoa_dues_amount'
                ? formatHoaDues(answers.hoa_dues_amount, answers.hoa_dues_frequency)
                : answers[field.key] || '',
        }))
        .filter((row) => row.value.length > 0);
}
