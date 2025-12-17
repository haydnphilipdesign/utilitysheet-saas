import { ProviderSuggestion, UtilityCategory } from '@/types';
import { MOCK_PROVIDERS, STATE_PROVIDERS, DEFAULT_PROVIDERS } from './mock-data';

// Simple cache for suggestions
const suggestionCache = new Map<string, { suggestions: ProviderSuggestion[]; timestamp: number }>();
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

// Extract state from address (simple regex)
function extractState(address: string): string | null {
    // Match common US state abbreviations and full names
    const statePatterns = [
        { pattern: /\b(NC|North Carolina)\b/i, state: 'NC' },
        { pattern: /\b(FL|Florida)\b/i, state: 'FL' },
        { pattern: /\b(CA|California)\b/i, state: 'CA' },
        { pattern: /\b(GA|Georgia)\b/i, state: 'GA' },
        { pattern: /\b(IL|Illinois)\b/i, state: 'IL' },
        { pattern: /\b(VA|Virginia)\b/i, state: 'VA' },
        { pattern: /\b(TX|Texas)\b/i, state: 'TX' },
        { pattern: /\b(NY|New York)\b/i, state: 'NY' },
    ];

    for (const { pattern, state } of statePatterns) {
        if (pattern.test(address)) {
            return state;
        }
    }

    return null;
}

// Generate cache key
function getCacheKey(address: string, category: UtilityCategory): string {
    const state = extractState(address) || 'DEFAULT';
    return `${state}:${category}`;
}

/**
 * Get provider suggestions based on address and category
 * This is a mock implementation that uses static data
 */
export async function getSuggestions(
    address: string,
    category: UtilityCategory
): Promise<ProviderSuggestion[]> {
    const cacheKey = getCacheKey(address, category);

    // Check cache
    const cached = suggestionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.suggestions;
    }

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));

    const state = extractState(address);
    const providerNames = state && STATE_PROVIDERS[state]
        ? STATE_PROVIDERS[state][category]
        : DEFAULT_PROVIDERS[category];

    // Convert to suggestions with confidence scores
    const suggestions: ProviderSuggestion[] = providerNames.map((name, index) => {
        const canonical = MOCK_PROVIDERS.find((p) => p.normalized_name === name);
        return {
            display_name: name,
            canonical_id: canonical?.id,
            confidence: Math.max(0.6, 0.95 - index * 0.15), // First suggestion has highest confidence
            rationale_short: state
                ? `Common ${category} provider in ${state}`
                : `Common ${category} provider`,
        };
    });

    // Cache results
    suggestionCache.set(cacheKey, { suggestions, timestamp: Date.now() });

    return suggestions;
}

/**
 * Get all suggestions for all categories at once (for prefetching)
 */
export async function getAllSuggestions(
    address: string,
    categories: UtilityCategory[]
): Promise<Record<UtilityCategory, ProviderSuggestion[]>> {
    const results = await Promise.all(
        categories.map(async (category) => ({
            category,
            suggestions: await getSuggestions(address, category),
        }))
    );

    return results.reduce(
        (acc, { category, suggestions }) => {
            acc[category] = suggestions;
            return acc;
        },
        {} as Record<UtilityCategory, ProviderSuggestion[]>
    );
}

/**
 * Search providers by name (for autocomplete)
 */
export async function searchProviders(
    query: string,
    category?: UtilityCategory
): Promise<ProviderSuggestion[]> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));

    const lowerQuery = query.toLowerCase();

    const matches = MOCK_PROVIDERS.filter((provider) => {
        // Filter by category if specified
        if (category && !provider.service_types.includes(category)) {
            return false;
        }

        // Match against name and aliases
        const nameMatch = provider.normalized_name.toLowerCase().includes(lowerQuery);
        const aliasMatch = provider.aliases.some((alias) =>
            alias.toLowerCase().includes(lowerQuery)
        );

        return nameMatch || aliasMatch;
    });

    return matches.map((provider) => ({
        display_name: provider.normalized_name,
        canonical_id: provider.id,
        confidence: 1.0, // User searched explicitly
    }));
}
