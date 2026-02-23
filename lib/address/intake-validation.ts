import {
    US_STATES,
    parseAddressWithConfidence,
    resolveStateAbbreviation,
} from '@/lib/address/location-parser';

export type IntakeMissingField = 'street' | 'city' | 'state' | 'zip';

export interface IntakeAddressParts {
    street: string;
    city: string;
    state: string;
    zip: string;
}

export interface IntakeAddressValidationResult {
    isComplete: boolean;
    missingFields: IntakeMissingField[];
    parsed: IntakeAddressParts;
}

function normalizeWhitespace(value: string | null | undefined): string {
    return String(value || '')
        .trim()
        .replace(/\s+/g, ' ');
}

function normalizeZip(value: string | null | undefined): string {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length >= 5) return digits.slice(0, 5);
    return digits;
}

function normalizeState(value: string | null | undefined): string {
    const resolved = resolveStateAbbreviation(String(value || ''));
    return resolved || '';
}

export function normalizeIntakeAddressParts(input: Partial<IntakeAddressParts>): IntakeAddressParts {
    return {
        street: normalizeWhitespace(input.street),
        city: normalizeWhitespace(input.city),
        state: normalizeState(input.state),
        zip: normalizeZip(input.zip),
    };
}

export function getMissingIntakeFields(parts: IntakeAddressParts): IntakeMissingField[] {
    const missing: IntakeMissingField[] = [];

    if (!parts.street) missing.push('street');
    if (!parts.city) missing.push('city');
    if (!parts.state) missing.push('state');
    if (!/^\d{5}$/.test(parts.zip)) missing.push('zip');

    return missing;
}

export function validateIntakeAddress(address: string): IntakeAddressValidationResult {
    const parsed = parseAddressWithConfidence(address || '');
    const normalized = normalizeIntakeAddressParts({
        street: parsed.street || '',
        city: parsed.city || '',
        state: parsed.state || '',
        zip: parsed.zip || '',
    });
    const missingFields = getMissingIntakeFields(normalized);

    return {
        isComplete: missingFields.length === 0,
        missingFields,
        parsed: normalized,
    };
}

export function formatCanonicalIntakeAddress(input: {
    street: string;
    city: string;
    state: string;
    zip: string;
    unit?: string | null;
}): string {
    const normalized = normalizeIntakeAddressParts(input);
    const normalizedUnit = normalizeWhitespace(input.unit || '');
    const streetLine = normalizedUnit
        ? `${normalized.street} ${normalizedUnit}`
        : normalized.street;
    return `${streetLine}, ${normalized.city}, ${normalized.state} ${normalized.zip}`;
}

export const US_STATE_CODES = Array.from(
    new Set(Object.values(US_STATES))
).sort((a, b) => a.localeCompare(b));
