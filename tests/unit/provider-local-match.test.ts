import { describe, expect, it } from 'vitest';
import { filterSuggestionsByQuery } from '@/lib/providers/local-match';

const suggestions = [
    { display_name: 'Pennsylvania American Water', confidence: 0.9 },
    { display_name: 'Aqua Pennsylvania', confidence: 0.7 },
    { display_name: 'Pacific Gas & Electric (PG&E)', confidence: 0.6 },
];

function names(query: string) {
    return filterSuggestionsByQuery(suggestions, query).map((item) => item.display_name);
}

describe('filterSuggestionsByQuery', () => {
    it('matches part of a name, ignoring case and punctuation', () => {
        expect(names('aqua')).toEqual(['Aqua Pennsylvania']);
        expect(names('AMERICAN  water')).toEqual(['Pennsylvania American Water']);
        expect(names('pennsyl')).toEqual(['Pennsylvania American Water', 'Aqua Pennsylvania']);
    });

    it('matches words in any order', () => {
        expect(names('water pennsylvania')).toEqual(['Pennsylvania American Water']);
    });

    it('matches an abbreviation typed without its punctuation', () => {
        expect(names('pge')).toEqual(['Pacific Gas & Electric (PG&E)']);
    });

    it('returns nothing for an empty query or a name that is not loaded', () => {
        expect(names('   ')).toEqual([]);
        expect(names('hilltop')).toEqual([]);
    });
});
