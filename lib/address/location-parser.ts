import type { PropertyAddressStructured } from '@/types';

export type LocationConfidence = 'high' | 'medium' | 'low';
export type LocationSource = 'local' | 'verified';

export interface ParsedLocation {
    raw: string;
    normalized: string;
    street: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    confidence: LocationConfidence;
    issues: string[];
    source: LocationSource;
}

export const US_STATES: Record<string, string> = {
    'alabama': 'AL', 'al': 'AL',
    'alaska': 'AK', 'ak': 'AK',
    'arizona': 'AZ', 'az': 'AZ',
    'arkansas': 'AR', 'ar': 'AR',
    'california': 'CA', 'ca': 'CA',
    'colorado': 'CO', 'co': 'CO',
    'connecticut': 'CT', 'ct': 'CT',
    'delaware': 'DE', 'de': 'DE',
    'florida': 'FL', 'fl': 'FL',
    'georgia': 'GA', 'ga': 'GA',
    'hawaii': 'HI', 'hi': 'HI',
    'idaho': 'ID', 'id': 'ID',
    'illinois': 'IL', 'il': 'IL',
    'indiana': 'IN', 'in': 'IN',
    'iowa': 'IA', 'ia': 'IA',
    'kansas': 'KS', 'ks': 'KS',
    'kentucky': 'KY', 'ky': 'KY',
    'louisiana': 'LA', 'la': 'LA',
    'maine': 'ME', 'me': 'ME',
    'maryland': 'MD', 'md': 'MD',
    'massachusetts': 'MA', 'ma': 'MA',
    'michigan': 'MI', 'mi': 'MI',
    'minnesota': 'MN', 'mn': 'MN',
    'mississippi': 'MS', 'ms': 'MS',
    'missouri': 'MO', 'mo': 'MO',
    'montana': 'MT', 'mt': 'MT',
    'nebraska': 'NE', 'ne': 'NE',
    'nevada': 'NV', 'nv': 'NV',
    'new hampshire': 'NH', 'nh': 'NH',
    'new jersey': 'NJ', 'nj': 'NJ',
    'new mexico': 'NM', 'nm': 'NM',
    'new york': 'NY', 'ny': 'NY',
    'north carolina': 'NC', 'nc': 'NC',
    'north dakota': 'ND', 'nd': 'ND',
    'ohio': 'OH', 'oh': 'OH',
    'oklahoma': 'OK', 'ok': 'OK',
    'oregon': 'OR', 'or': 'OR',
    'pennsylvania': 'PA', 'pa': 'PA',
    'rhode island': 'RI', 'ri': 'RI',
    'south carolina': 'SC', 'sc': 'SC',
    'south dakota': 'SD', 'sd': 'SD',
    'tennessee': 'TN', 'tn': 'TN',
    'texas': 'TX', 'tx': 'TX',
    'utah': 'UT', 'ut': 'UT',
    'vermont': 'VT', 'vt': 'VT',
    'virginia': 'VA', 'va': 'VA',
    'washington': 'WA', 'wa': 'WA',
    'west virginia': 'WV', 'wv': 'WV',
    'wisconsin': 'WI', 'wi': 'WI',
    'wyoming': 'WY', 'wy': 'WY',
    'district of columbia': 'DC', 'dc': 'DC', 'washington dc': 'DC', 'washington d.c.': 'DC',
};

const STATE_FULL_NAMES = Object.keys(US_STATES)
    .filter((k) => k.length > 2)
    .sort((a, b) => b.length - a.length);

// Includes common address-token collisions, e.g. "Ct" (Court) should not map to CT without location context.
const AMBIGUOUS_STATE_ABBREVIATIONS = new Set(['IN', 'OR', 'ME', 'HI', 'AR', 'CT']);
const VALID_STATE_CODES = new Set(
    Object.values(US_STATES)
);
const STREET_SUFFIXES = new Set([
    'aly', 'allee', 'alley',
    'ave', 'avenue',
    'blvd', 'boulevard',
    'cir', 'circle',
    'court', 'ct',
    'dr', 'drive',
    'hwy', 'highway',
    'ln', 'lane',
    'loop',
    'pkwy', 'parkway',
    'pl', 'place',
    'rd', 'road',
    'sq', 'square',
    'st', 'street',
    'ter', 'terrace',
    'trl', 'trail',
    'way',
]);

function cleanSegment(input: string): string {
    return input
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^[,\-.\s]+/, '')
        .replace(/[,\-.\s]+$/, '');
}

export function normalizeAddressInput(input: string): string {
    return input
        .normalize('NFKC')
        .replace(/[，;]+/g, ',')
        .replace(/\s*,\s*/g, ', ')
        .replace(/\s+/g, ' ')
        .trim();
}

function editDistanceAtMostOne(a: string, b: string): boolean {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;

    let i = 0;
    let j = 0;
    let edits = 0;

    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) {
            i++;
            j++;
            continue;
        }

        edits++;
        if (edits > 1) return false;

        if (a.length > b.length) {
            i++;
        } else if (b.length > a.length) {
            j++;
        } else {
            i++;
            j++;
        }
    }

    if (i < a.length || j < b.length) edits++;
    return edits <= 1;
}

function getWords(input: string): string[] {
    return input
        .replace(/,/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
}

function stripTrailingZip(input: string): string {
    return cleanSegment(
        input.replace(/\b\d{5}(?:[-\s]?\d{4})?\b\s*$/i, '')
    );
}

function stripTrailingResolvedState(input: string, state: string | null): string {
    if (!state) return cleanSegment(input);

    const words = getWords(input);
    for (let length = Math.min(3, words.length); length >= 1; length--) {
        const phrase = words.slice(-length).join(' ');
        if (resolveStateAbbreviation(phrase) === state) {
            return cleanSegment(words.slice(0, -length).join(' '));
        }
    }

    return cleanSegment(input);
}

function normalizeStreetSuffixToken(token: string): string {
    return token.toLowerCase().replace(/[^a-z]/g, '');
}

function deriveStreetAndCityFromCommaLessAddress(
    address: string,
    state: string | null,
    zip: string | null
): { street: string | null; city: string | null } {
    let working = normalizeAddressInput(address);
    if (zip) {
        const zipRegex = new RegExp(`\\b${zip}(?:[-\\s]?\\d{4})?\\b\\s*$`, 'i');
        working = cleanSegment(working.replace(zipRegex, ''));
    }

    working = stripTrailingResolvedState(working, state);
    const words = getWords(working);
    if (words.length === 0) {
        return { street: null, city: null };
    }

    let streetSuffixIndex = -1;
    for (let i = 0; i < words.length - 1; i++) {
        if (STREET_SUFFIXES.has(normalizeStreetSuffixToken(words[i]))) {
            streetSuffixIndex = i;
        }
    }

    if (streetSuffixIndex >= 0 && streetSuffixIndex < words.length - 1) {
        return {
            street: cleanSegment(words.slice(0, streetSuffixIndex + 1).join(' ')) || null,
            city: toTitleCase(words.slice(streetSuffixIndex + 1).join(' ')) || null,
        };
    }

    return {
        street: cleanSegment(working) || null,
        city: null,
    };
}

function deriveCityFromCommaSeparatedSegments(segments: string[], state: string | null): string | null {
    if (segments.length < 2) return null;

    for (let i = segments.length - 1; i >= 0; i--) {
        const segment = cleanSegment(segments[i]);
        const hasZip = /\b\d{5}(?:[-\s]?\d{4})?\b/.test(segment);
        const resolvedSegmentState = resolveStateAbbreviation(segment);
        const hasState = Boolean(state && resolvedSegmentState === state);

        if (!hasZip && !hasState) {
            continue;
        }

        const previous = i > 0 ? cleanSegment(segments[i - 1]) : '';
        const previousResolvedState = resolveStateAbbreviation(previous);
        const candidate = previousResolvedState && state && previousResolvedState === state && i > 1
            ? cleanSegment(segments[i - 2])
            : previous;
        const strippedCandidate = stripTrailingResolvedState(stripTrailingZip(candidate), state);

        if (strippedCandidate && !looksLikeStreetLine(strippedCandidate)) {
            return toTitleCase(strippedCandidate);
        }
    }

    const fallback = stripTrailingResolvedState(stripTrailingZip(segments[1]), state);
    if (fallback && !looksLikeStreetLine(fallback)) {
        return toTitleCase(fallback);
    }

    return null;
}

export function resolveStateAbbreviation(input: string): string | null {
    const normalized = input.toLowerCase().trim();

    if (US_STATES[normalized]) {
        return US_STATES[normalized];
    }

    const upper = normalized.toUpperCase();
    if (VALID_STATE_CODES.has(upper)) {
        return upper;
    }

    for (const name of STATE_FULL_NAMES) {
        if (editDistanceAtMostOne(normalized, name)) {
            return US_STATES[name];
        }
    }

    return null;
}

function findState(address: string): string | null {
    const withoutZip = stripTrailingZip(address);
    const words = getWords(withoutZip);

    for (let length = Math.min(3, words.length); length >= 1; length--) {
        const phrase = words.slice(-length).join(' ');
        const resolved = resolveStateAbbreviation(phrase);
        if (resolved) {
            return resolved;
        }
    }

    const normalized = address.toLowerCase();

    for (const name of STATE_FULL_NAMES) {
        const escapedName = name
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\s+/g, '\\s+');
        const fullRegex = new RegExp(`\\b${escapedName}\\b`, 'i');
        if (fullRegex.test(normalized)) {
            return US_STATES[name];
        }
    }

    const abbreviationRegex = /\b([A-Za-z]{2})\b/g;
    let match: RegExpExecArray | null;
    while ((match = abbreviationRegex.exec(address)) !== null) {
        const candidate = match[1].toUpperCase();
        if (!VALID_STATE_CODES.has(candidate)) continue;

        if (!AMBIGUOUS_STATE_ABBREVIATIONS.has(candidate)) {
            return candidate;
        }

        const right = address.slice(match.index + match[0].length);
        const left = address.slice(0, match.index);
        const hasGoodRightContext = /^\s*(?:,|\d{5}\b|$)/.test(right);
        const hasGoodLeftContext = /(?:,|\s)$/.test(left);
        if (hasGoodLeftContext && hasGoodRightContext) {
            return candidate;
        }
    }

    const locationTail = normalized.includes(',')
        ? normalized
            .split(',')
            .map(cleanSegment)
            .filter(Boolean)
            .slice(-2)
            .join(' ')
        : normalized;
    const normalizedWords = locationTail.replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const tokens = normalizedWords ? normalizedWords.split(' ') : [];
    const tailTokens = tokens.slice(Math.max(0, tokens.length - 5));

    for (let length = 1; length <= 3; length++) {
        for (let i = 0; i + length <= tailTokens.length; i++) {
            const phrase = tailTokens.slice(i, i + length).join(' ');
            for (const stateName of STATE_FULL_NAMES) {
                if (stateName.split(' ').length !== length) continue;
                if (editDistanceAtMostOne(phrase, stateName)) {
                    return US_STATES[stateName];
                }
            }
        }
    }

    return null;
}

function findZip(address: string): string | null {
    const zipMatches = Array.from(address.matchAll(/\b(\d{5})(?:[-\s]?(\d{4}))?\b/g));
    const lastMatch = zipMatches.at(-1);
    return lastMatch ? lastMatch[1] : null;
}

function toTitleCase(input: string): string {
    return input
        .split(/\s+/)
        .filter(Boolean)
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
        .join(' ');
}

function looksLikeStreetLine(input: string): boolean {
    return /^\d+/.test(input) || /\b(st|street|ave|avenue|rd|road|blvd|drive|dr|ln|lane|way|ct|court)\b/i.test(input);
}

function findCity(address: string, state: string | null): string | null {
    const withCommas = address.split(',').map(cleanSegment).filter(Boolean);
    if (withCommas.length >= 2) {
        const commaSeparatedCity = deriveCityFromCommaSeparatedSegments(withCommas, state);
        if (commaSeparatedCity) {
            return commaSeparatedCity;
        }
    }

    const noComma = address.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    const statePattern = state ? state : '[A-Za-z]{2}';
    const cityStateRegex = new RegExp(
        `([A-Za-z][A-Za-z'\\-.\\s]{1,40}?)\\s+${statePattern}(?:\\s+\\d{5}(?:[-\\s]?\\d{4})?)?$`,
        'i'
    );
    const match = noComma.match(cityStateRegex);
    if (match) {
        const cityCandidate = cleanSegment(match[1]);
        if (cityCandidate && !looksLikeStreetLine(cityCandidate)) {
            return toTitleCase(cityCandidate);
        }
    }

    const derived = deriveStreetAndCityFromCommaLessAddress(noComma, state, findZip(address));
    if (derived.city) {
        return derived.city;
    }

    return null;
}

function findStreet(address: string, city: string | null, state: string | null, zip: string | null): string | null {
    const commaSplit = address.split(',').map(cleanSegment).filter(Boolean);
    if (commaSplit.length > 0) {
        let first = commaSplit[0];
        const reparsedFirstSegment = deriveStreetAndCityFromCommaLessAddress(first, state, zip);
        if (reparsedFirstSegment.street && reparsedFirstSegment.street.length < first.length) {
            first = reparsedFirstSegment.street;
        }
        if (city && first.toLowerCase() === city.toLowerCase()) {
            return null;
        }
        return first || null;
    }

    return deriveStreetAndCityFromCommaLessAddress(address, state, zip).street;
}

export function parseAddressWithConfidence(address: string): ParsedLocation {
    const normalized = normalizeAddressInput(address || '');
    const state = findState(normalized);
    const zip = findZip(normalized);
    const city = findCity(normalized, state);
    const street = findStreet(normalized, city, state, zip);
    const issues: string[] = [];

    let confidence: LocationConfidence = 'low';
    if (street && city && state && zip) {
        confidence = 'high';
    } else if (street && (city || state || zip)) {
        confidence = 'medium';
    } else if (state || zip) {
        confidence = 'medium';
    }

    if (!state) issues.push('state_missing_or_unrecognized');
    if (!city) issues.push('city_missing_or_unrecognized');
    if (!zip) issues.push('zip_missing_or_unrecognized');
    if (!street) issues.push('street_missing_or_unrecognized');

    return {
        raw: address,
        normalized,
        street,
        city,
        state,
        zip,
        confidence,
        issues,
        source: 'local',
    };
}

export function buildLocationContext(parsed: ParsedLocation): { label: string; lines: string[] } {
    const lines: string[] = [];
    if (parsed.city) lines.push(`City: ${parsed.city}`);
    if (parsed.state) lines.push(`State: ${parsed.state}`);
    if (parsed.zip) lines.push(`ZIP: ${parsed.zip}`);
    lines.push(`Location Confidence: ${parsed.confidence}`);
    if (parsed.issues.length > 0) {
        lines.push(`Location Issues: ${parsed.issues.join(', ')}`);
    }

    const parts = [parsed.city, parsed.state, parsed.zip].filter(Boolean) as string[];
    return {
        label: parts.length > 0 ? parts.join(', ') : 'Unknown',
        lines,
    };
}

export function toStructuredPropertyAddress(parsed: ParsedLocation): PropertyAddressStructured {
    return {
        street: parsed.street || '',
        city: parsed.city || '',
        state: parsed.state || '',
        zip: parsed.zip || '',
        full: parsed.raw,
        confidence: parsed.confidence,
        issues: parsed.issues,
        source: parsed.source,
    };
}
