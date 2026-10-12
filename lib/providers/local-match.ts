import type { ProviderSuggestion } from '@/types';

function normalize(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Suggestions already loaded for the category whose name contains what the
 * seller has typed so far. Runs in the browser so typing costs no lookup.
 */
export function filterSuggestionsByQuery(
    suggestions: ProviderSuggestion[],
    query: string
): ProviderSuggestion[] {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return [];

    const tokens = normalizedQuery.split(' ');
    const compactQuery = normalizedQuery.replace(/ /g, '');

    return suggestions.filter((suggestion) => {
        const name = normalize(suggestion.display_name);
        if (tokens.every((token) => name.includes(token))) return true;
        // "pge" should still find "PG&E".
        return name.replace(/ /g, '').includes(compactQuery);
    });
}
