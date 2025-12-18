import { ProviderSuggestion, UtilityCategory } from '@/types';
import { generateJSON, isGeminiConfigured } from '@/lib/ai/gemini-client';
// Mock providers removed - using AI only

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

// AI prompt for provider suggestions
function buildSuggestionPrompt(address: string, category: UtilityCategory): string {
    return `You are an expert on utility providers in the United States.

Given the following property address and utility category, identify the most likely utility providers that serve this location.

Address: ${address}
Utility Category: ${category}

Respond with a JSON array of provider suggestions. Each suggestion should have:
- display_name: The official name of the utility provider
- confidence: A number between 0 and 1 indicating how confident you are this is the correct provider (1 = very confident)
- rationale_short: A brief explanation of why this provider serves this area

Return 1-3 providers, ordered by confidence (highest first).
Only include providers you are reasonably confident serve this specific area.

Example response format:
[
  {
    "display_name": "Duke Energy",
    "confidence": 0.9,
    "rationale_short": "Major electric provider in North Carolina"
  }
]

Respond ONLY with the JSON array, no additional text.`;
}

/**
 * Get provider suggestions using Gemini AI
 * Falls back to mock data if AI is unavailable
 */
async function getAISuggestions(
    address: string,
    category: UtilityCategory
): Promise<ProviderSuggestion[] | null> {
    if (!isGeminiConfigured()) {
        return null;
    }

    const prompt = buildSuggestionPrompt(address, category);
    const result = await generateJSON<ProviderSuggestion[]>(prompt);

    if (!result || !Array.isArray(result)) {
        return null;
    }

    // Validate and normalize the response
    return result
        .filter(s => s.display_name && typeof s.confidence === 'number')
        .map(s => ({
            display_name: s.display_name,
            confidence: Math.max(0, Math.min(1, s.confidence)),
            rationale_short: s.rationale_short || `${category} provider for this area`,
        }));
}

/**
 * Fallback removed - using AI only
 */
function getMockSuggestions(address: string, category: UtilityCategory): ProviderSuggestion[] {
    return [];
}

/**
 * Get provider suggestions based on address and category
 * Uses Gemini AI when available, falls back to mock data
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

    // Try AI - no mock fallback
    let suggestions = await getAISuggestions(address, category);

    if (!suggestions) {
        suggestions = [];
    } else {
        console.log(`[Suggestions] Got AI suggestions for ${category} at ${address}`);
    }

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
 * Search providers by name (for autocomplete) using Gemini AI
 */
export async function searchProviders(
    query: string,
    category?: UtilityCategory
): Promise<ProviderSuggestion[]> {
    if (!isGeminiConfigured() || query.length < 2) {
        return [];
    }

    const prompt = `You are an expert on utility providers in the United States.
    
    A user is searching for a utility provider. 
    Query: "${query}"
    ${category ? `Expected Category: ${category}` : ''}

    Find the most likely official utility providers matching this query. 
    Respond with a JSON array of up to 5 provider suggestions. Each suggestion should have:
    - display_name: The official name of the utility provider
    - confidence: A number between 0 and 1 indicating how confident you are this is a real and relevant provider
    - rationale_short: A brief explanation of who they are/where they serve

    Respond ONLY with the JSON array, no additional text.`;

    const result = await generateJSON<ProviderSuggestion[]>(prompt);

    if (!result || !Array.isArray(result)) {
        return [];
    }

    return result
        .filter(s => s.display_name && typeof s.confidence === 'number')
        .map(s => ({
            display_name: s.display_name,
            confidence: Math.max(0, Math.min(1, s.confidence)),
            rationale_short: s.rationale_short || (category ? `${category} provider` : 'Utility provider'),
        }));
}
