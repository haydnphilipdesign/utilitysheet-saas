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

// Category-specific guidance for better AI suggestions
function getCategoryGuidance(category: UtilityCategory): string {
    switch (category) {
        case 'electric':
            return `Electric utilities are typically large regional or state-regulated companies. Look for the primary electric provider for this area (e.g., Duke Energy, Florida Power & Light, PG&E, etc.). There is usually one main provider per region.`;
        case 'gas':
            return `Natural gas utilities are typically regional gas companies regulated by the state public utility commission. Look for the primary natural gas provider for this area. There is usually one main provider per region.`;
        case 'water':
            return `Water utilities are often municipal (city/county run) or regional water authorities. Look for the local water utility that serves this specific address. Include the city or county name if it's municipal water.`;
        case 'sewer':
            return `Sewer services are typically provided by the same entity as water (municipal or county). Look for the local sewer/wastewater utility for this address.`;
        case 'trash':
            return `Trash/waste collection can be either municipal (city-provided) or private waste management companies. Look for options like Waste Management, Republic Services, or local municipal sanitation services.`;
        case 'propane':
            return `Propane is delivered by LOCAL fuel delivery companies, NOT utilities. These are often regional or family-owned businesses. Look for propane delivery companies that serve this specific area/county. Examples include AmeriGas, Ferrellgas, Suburban Propane, or local companies like "[County] Propane" or "[Town] Gas & Oil". Propane companies vary significantly by location.`;
        case 'oil':
            return `Heating oil is delivered by LOCAL fuel delivery companies, NOT utilities. These are often regional or family-owned businesses that deliver heating oil. Look for heating oil delivery companies that serve this specific area, especially common in the Northeast US. Examples include local companies or regional chains.`;
        case 'internet':
            return `Internet service providers (ISPs) include major carriers like Xfinity/Comcast, AT&T, Verizon Fios, Spectrum, Cox, CenturyLink, Google Fiber, and regional providers. List the major ISPs that provide service to this address area.`;
        case 'cable':
            return `Cable TV providers are often the same as internet providers. Major cable companies include Xfinity/Comcast, Spectrum, Cox, Optimum, and regional cable companies. Note: DirecTV and Dish are satellite, not cable.`;
        default:
            return `Look for utility providers that serve this area.`;
    }
}

// AI prompt for provider suggestions
function buildSuggestionPrompt(address: string, category: UtilityCategory): string {
    const categoryGuidance = getCategoryGuidance(category);

    return `You are an expert on utility providers in the United States.

Given the following property address and utility category, identify the most likely utility providers that serve this location.

Address: ${address}
Utility Category: ${category}

IMPORTANT GUIDANCE FOR ${category.toUpperCase()}:
${categoryGuidance}

Respond with a JSON array of provider suggestions. Each suggestion should have:
- display_name: The official name of the utility provider
- confidence: A number between 0 and 1 indicating how confident you are this is the correct provider (1 = very confident)
- rationale_short: A brief explanation of why this provider serves this area
- contact_phone: The customer service phone number if known (format: "(XXX) XXX-XXXX" or null if unknown)
- contact_website: The provider's main website URL if known (format: "https://..." or null if unknown)

Return 3-5 likely providers, ordered by confidence (highest first).
If there is one dominant provider, list it first, but still try to provide 2-3 other plausible alternatives or competitors in the area (mark them with slightly lower confidence).
Only include providers you are reasonably confident serve this specific area.

Example response format:
[
  {
    "display_name": "Duke Energy",
    "confidence": 0.9,
    "rationale_short": "Major electric provider in North Carolina",
    "contact_phone": "(800) 777-9898",
    "contact_website": "https://www.duke-energy.com"
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
            contact_phone: s.contact_phone || undefined,
            contact_website: s.contact_website || undefined,
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

    const categoryHint = category ? getCategoryGuidance(category) : '';

    const prompt = `You are an expert on utility providers in the United States.
    
    A user is searching for a utility provider. 
    Query: "${query}"
    ${category ? `Expected Category: ${category}` : ''}
    ${categoryHint ? `\nContext: ${categoryHint}` : ''}

    Find the most likely official utility providers matching this query. 
    Respond with a JSON array of up to 5 provider suggestions. Each suggestion should have:
    - display_name: The official name of the utility provider
    - confidence: A number between 0 and 1 indicating how confident you are this is a real and relevant provider
    - rationale_short: A brief explanation of who they are/where they serve
    - contact_phone: The customer service phone number if known (format: "(XXX) XXX-XXXX" or null if unknown)
    - contact_website: The provider's main website URL if known (format: "https://..." or null if unknown)

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
            contact_phone: s.contact_phone || undefined,
            contact_website: s.contact_website || undefined,
        }));
}
