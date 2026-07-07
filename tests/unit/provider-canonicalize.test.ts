import { describe, expect, it } from 'vitest';
import { canonicalProviderKey, dedupeProviderSuggestions } from '@/lib/providers/canonicalize';
import type { ProviderSuggestion } from '@/types';

function suggestion(overrides: Partial<ProviderSuggestion> & { display_name: string }): ProviderSuggestion {
    return {
        confidence: 0.5,
        ...overrides,
    };
}

describe('canonicalProviderKey', () => {
    it('collapses case and punctuation differences', () => {
        expect(canonicalProviderKey('Waste-Management!')).toBe(canonicalProviderKey('waste management'));
    });

    it('treats "&" and "and" the same', () => {
        expect(canonicalProviderKey('Baltimore Gas & Electric')).toBe(canonicalProviderKey('Baltimore Gas and Electric'));
    });

    it('expands safe state abbreviations', () => {
        expect(canonicalProviderKey('PA American Water')).toBe(canonicalProviderKey('Pennsylvania American Water'));
        expect(canonicalProviderKey('NJ Natural Gas')).toBe(canonicalProviderKey('New Jersey Natural Gas'));
    });

    it('does not expand ambiguous tokens like Co, In, or Or', () => {
        expect(canonicalProviderKey('Smith Water Co')).not.toContain('colorado');
        expect(canonicalProviderKey('Duke Energy Indiana')).not.toBe(canonicalProviderKey('Duke Energy'));
    });

    it('strips corporate suffixes', () => {
        expect(canonicalProviderKey('Waste Management Inc')).toBe(canonicalProviderKey('Waste Management'));
        expect(canonicalProviderKey('Southern California Gas Company')).toBe(canonicalProviderKey('Southern California Gas'));
        expect(canonicalProviderKey('California Water Service Co.')).toBe(canonicalProviderKey('California Water Service'));
    });

    it('drops connector words and leading articles', () => {
        expect(canonicalProviderKey('American Water of Pennsylvania')).toBe(canonicalProviderKey('Pennsylvania American Water'));
        expect(canonicalProviderKey('The Illuminating Company')).toBe(canonicalProviderKey('Illuminating'));
    });

    it('ignores parenthetical annotations', () => {
        expect(canonicalProviderKey('Met-Ed (FirstEnergy)')).toBe(canonicalProviderKey('Met-Ed'));
    });

    it('maps well-known brand aliases together', () => {
        expect(canonicalProviderKey('PG&E')).toBe(canonicalProviderKey('Pacific Gas & Electric'));
        expect(canonicalProviderKey('Xfinity (Comcast)')).toBe(canonicalProviderKey('Comcast'));
        expect(canonicalProviderKey('ConEd')).toBe(canonicalProviderKey('Consolidated Edison'));
    });

    it('keeps genuinely distinct providers distinct', () => {
        expect(canonicalProviderKey('Duke Energy')).not.toBe(canonicalProviderKey('Duke Energy Progress'));
        expect(canonicalProviderKey('Pennsylvania American Water')).not.toBe(canonicalProviderKey('Aqua Pennsylvania'));
        expect(canonicalProviderKey('Republic Services')).not.toBe(canonicalProviderKey('Waste Connections'));
    });

    it('never returns an empty key for suffix-only names', () => {
        expect(canonicalProviderKey('Co')).not.toBe('');
    });
});

describe('dedupeProviderSuggestions', () => {
    it('merges abbreviation variants and keeps the spelled-out name', () => {
        const result = dedupeProviderSuggestions([
            suggestion({ display_name: 'PA American Water', confidence: 0.9 }),
            suggestion({ display_name: 'Pennsylvania American Water', confidence: 0.8 }),
        ]);

        expect(result).toHaveLength(1);
        expect(result[0].display_name).toBe('Pennsylvania American Water');
        expect(result[0].confidence).toBe(0.9);
    });

    it('merges contact info from both variants', () => {
        const result = dedupeProviderSuggestions([
            suggestion({ display_name: 'PA American Water', confidence: 0.9, contact_phone: '(800) 565-7292' }),
            suggestion({ display_name: 'Pennsylvania American Water', confidence: 0.7, contact_website: 'https://www.amwater.com/paaw/' }),
        ]);

        expect(result).toHaveLength(1);
        expect(result[0].contact_phone).toBe('(800) 565-7292');
        expect(result[0].contact_website).toBe('https://www.amwater.com/paaw/');
    });

    it('prefers higher confidence when neither name is abbreviated', () => {
        const result = dedupeProviderSuggestions([
            suggestion({ display_name: 'Waste Management Inc', confidence: 0.6 }),
            suggestion({ display_name: 'Waste Management', confidence: 0.9 }),
        ]);

        expect(result).toHaveLength(1);
        expect(result[0].display_name).toBe('Waste Management');
        expect(result[0].confidence).toBe(0.9);
    });

    it('leaves distinct providers untouched and preserves order', () => {
        const result = dedupeProviderSuggestions([
            suggestion({ display_name: 'Duke Energy', confidence: 0.9 }),
            suggestion({ display_name: 'Dominion Energy', confidence: 0.8 }),
            suggestion({ display_name: 'Piedmont Natural Gas', confidence: 0.7 }),
        ]);

        expect(result.map((item) => item.display_name)).toEqual([
            'Duke Energy',
            'Dominion Energy',
            'Piedmont Natural Gas',
        ]);
    });

    it('drops entries with empty display names', () => {
        const result = dedupeProviderSuggestions([
            suggestion({ display_name: '   ' }),
            suggestion({ display_name: 'Xcel Energy' }),
        ]);

        expect(result).toHaveLength(1);
        expect(result[0].display_name).toBe('Xcel Energy');
    });
});
