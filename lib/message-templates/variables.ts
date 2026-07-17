/**
 * Canonical list of variables that message templates may reference, plus
 * helpers to validate free-text templates and render a resolved preview from
 * safe example data. The renderer (render.ts) silently drops unknown/malformed
 * tokens, so this module is what surfaces them to the user before they save.
 */
import { renderTemplate, type TemplateVariables } from './render';

export interface MessageTemplateVariable {
    /** The token name, e.g. `property_address` (used as {{property_address}}). */
    key: string;
    /** Short human label for the insertion control. */
    label: string;
    /** Example value used in resolved previews. */
    example: string;
}

/**
 * The variables the seller request/reminder renderers actually supply
 * (see lib/email/email-service.ts). Keep this in sync with the values passed
 * to renderTemplate() there.
 */
export const MESSAGE_TEMPLATE_VARIABLES: MessageTemplateVariable[] = [
    { key: 'seller_first_name_with_space', label: 'Seller first name', example: ' Jordan' },
    { key: 'seller_name', label: 'Seller full name', example: 'Jordan Rivera' },
    { key: 'agent_name', label: 'Agent name', example: 'Alex Morgan' },
    { key: 'property_address', label: 'Property address', example: '123 Maple Ave, Austin, TX' },
    { key: 'closing_date', label: 'Closing date', example: 'Friday, August 1, 2026' },
    { key: 'link', label: 'Form link', example: 'https://utilitysheet.com/s/example' },
];

export const ALLOWED_MESSAGE_TEMPLATE_VARIABLE_KEYS = new Set(
    MESSAGE_TEMPLATE_VARIABLES.map((variable) => variable.key)
);

export const MESSAGE_TEMPLATE_PREVIEW_VARIABLES: TemplateVariables = Object.fromEntries(
    MESSAGE_TEMPLATE_VARIABLES.map((variable) => [variable.key, variable.example])
);

export interface MessageTemplateAnalysis {
    /** Well-formed {{name}} tokens whose name is not an allowed variable. */
    unknownVariables: string[];
    /** {{...}} spans whose contents are not a valid variable identifier. */
    malformedTokens: string[];
}

/**
 * Inspect a single template string for unknown variables and malformed tokens.
 * Empty/whitespace input is always clean.
 */
export function analyzeMessageTemplate(text: string | null | undefined): MessageTemplateAnalysis {
    const unknown = new Set<string>();
    const malformed = new Set<string>();

    if (!text) return { unknownVariables: [], malformedTokens: [] };

    // Well-formed {{ identifier }} tokens: flag names outside the allowed set.
    const tokenPattern = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
    let match: RegExpExecArray | null;
    while ((match = tokenPattern.exec(text)) !== null) {
        if (!ALLOWED_MESSAGE_TEMPLATE_VARIABLE_KEYS.has(match[1])) {
            unknown.add(match[1]);
        }
    }

    // Any {{...}} span whose inner text is not a valid identifier is malformed
    // (e.g. `{{ }}`, `{{ first name }}`, `{{seller-name}}`).
    const loosePattern = /{{([^{}]*)}}/g;
    while ((match = loosePattern.exec(text)) !== null) {
        const inner = match[1].trim();
        if (!/^[a-zA-Z0-9_]+$/.test(inner)) {
            malformed.add(match[0].trim());
        }
    }

    // An opening {{ with no closing }} ahead is also malformed/unclosed.
    if (/{{(?![^]*?}})/.test(text)) {
        malformed.add('{{ … (unclosed)');
    }

    return {
        unknownVariables: Array.from(unknown),
        malformedTokens: Array.from(malformed),
    };
}

/** Render a template against the safe example variables for preview display. */
export function renderMessageTemplatePreview(text: string): string {
    return renderTemplate(text, MESSAGE_TEMPLATE_PREVIEW_VARIABLES);
}
