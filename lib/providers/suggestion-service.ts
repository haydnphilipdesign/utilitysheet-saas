import { ProviderSuggestion, UtilityCategory } from '@/types';
import { generateJSON, isGeminiConfigured } from '@/lib/ai/gemini-client';

// Simple cache for suggestions
const suggestionCache = new Map<string, { suggestions: ProviderSuggestion[]; timestamp: number }>();
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

// ============================================================================
// US States Map (all 50 states + DC)
// ============================================================================
const US_STATES: Record<string, string> = {
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

// ============================================================================
// Address Parsing
// ============================================================================

interface ParsedAddress {
    state: string | null;
    city: string | null;
    zip: string | null;
}

/**
 * Parse address to extract state, city, and zip code
 */
function parseAddress(address: string): ParsedAddress {
    const result: ParsedAddress = { state: null, city: null, zip: null };
    const normalized = address.toLowerCase();

    // Extract ZIP code (5-digit or 5+4 format)
    const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
    if (zipMatch) {
        result.zip = zipMatch[1];
    }

    // Extract state - try abbreviations first, then full names
    for (const [key, abbr] of Object.entries(US_STATES)) {
        // Match state abbreviations with word boundaries
        if (key.length === 2) {
            const stateRegex = new RegExp(`\\b${key}\\b`, 'i');
            if (stateRegex.test(address)) {
                result.state = abbr;
                break;
            }
        } else {
            // Match full state names
            if (normalized.includes(key)) {
                result.state = abbr;
                break;
            }
        }
    }

    // Extract city - typically comes before state and after street address
    // Pattern: "City, ST" or "City, State"
    const cityMatch = address.match(/,\s*([A-Za-z\s]+?)\s*,\s*(?:[A-Z]{2}|[A-Za-z]+)\s*(?:\d{5})?/i);
    if (cityMatch) {
        result.city = cityMatch[1].trim();
    }

    return result;
}

/**
 * Generate cache key from address and category
 * Uses state + zip prefix for locality-specific caching
 */
function getCacheKey(address: string, category: UtilityCategory): string {
    const parsed = parseAddress(address);
    const state = parsed.state || 'DEFAULT';
    const locality = parsed.zip ? parsed.zip.substring(0, 3) : (parsed.city || 'UNKNOWN');
    return `${state}:${locality}:${category}`;
}

// ============================================================================
// Fallback Provider Database
// ============================================================================

type FallbackProviders = Record<UtilityCategory, ProviderSuggestion[]>;

const FALLBACK_PROVIDERS: FallbackProviders = {
    electric: [
        { display_name: 'Duke Energy', confidence: 0.5, rationale_short: 'Major electric utility serving the Southeast and Midwest' },
        { display_name: 'Pacific Gas & Electric (PG&E)', confidence: 0.5, rationale_short: 'Major California electric utility' },
        { display_name: 'Florida Power & Light (FPL)', confidence: 0.5, rationale_short: 'Major Florida electric utility' },
        { display_name: 'Xcel Energy', confidence: 0.5, rationale_short: 'Electric utility in 8 Western and Midwestern states' },
        { display_name: 'Dominion Energy', confidence: 0.5, rationale_short: 'Electric utility in Virginia and surrounding states' },
    ],
    gas: [
        { display_name: 'Atmos Energy', confidence: 0.5, rationale_short: 'Large natural gas distributor in 8 states' },
        { display_name: 'Dominion Energy', confidence: 0.5, rationale_short: 'Natural gas utility in multiple states' },
        { display_name: 'Southern California Gas', confidence: 0.5, rationale_short: 'Major California natural gas utility' },
        { display_name: 'Piedmont Natural Gas', confidence: 0.5, rationale_short: 'Natural gas utility in NC, SC, and TN' },
        { display_name: 'National Fuel Gas', confidence: 0.5, rationale_short: 'Natural gas utility in NY and PA' },
    ],
    water: [
        { display_name: 'American Water', confidence: 0.5, rationale_short: 'Largest investor-owned water utility in the US' },
        { display_name: 'Aqua America', confidence: 0.5, rationale_short: 'Water utility serving 8 states' },
        { display_name: 'California Water Service', confidence: 0.5, rationale_short: 'Major water utility in California' },
        { display_name: 'Municipal Water Authority', confidence: 0.4, rationale_short: 'Many areas have city/county-run water services' },
    ],
    sewer: [
        { display_name: 'Municipal Sewer Authority', confidence: 0.5, rationale_short: 'Most sewer services are city/county-run' },
        { display_name: 'American Water (Wastewater)', confidence: 0.4, rationale_short: 'Some areas have private wastewater services' },
    ],
    trash: [
        { display_name: 'Waste Management', confidence: 0.6, rationale_short: 'Largest waste services company in North America' },
        { display_name: 'Republic Services', confidence: 0.6, rationale_short: 'Second-largest waste services company in the US' },
        { display_name: 'Waste Connections', confidence: 0.5, rationale_short: 'Major waste services company' },
        { display_name: 'Municipal Sanitation', confidence: 0.4, rationale_short: 'Many cities provide trash pickup directly' },
    ],
    propane: [
        { display_name: 'AmeriGas', confidence: 0.6, rationale_short: 'Largest retail propane distributor in the US' },
        { display_name: 'Ferrellgas', confidence: 0.5, rationale_short: 'Major propane distributor nationwide' },
        { display_name: 'Suburban Propane', confidence: 0.5, rationale_short: 'National propane distributor' },
        { display_name: 'ThompsonGas', confidence: 0.4, rationale_short: 'Regional propane distributor' },
    ],
    oil: [
        { display_name: 'Petro Home Services', confidence: 0.5, rationale_short: 'Major heating oil provider in the Northeast' },
        { display_name: 'Shipley Energy', confidence: 0.4, rationale_short: 'Heating oil provider in PA, MD, and surrounding areas' },
        { display_name: 'Besco Oil', confidence: 0.4, rationale_short: 'Heating oil provider in the Northeast' },
    ],
    internet: [
        { display_name: 'Xfinity (Comcast)', confidence: 0.6, rationale_short: 'Largest internet provider in the US' },
        { display_name: 'AT&T Internet', confidence: 0.6, rationale_short: 'Major internet provider nationwide' },
        { display_name: 'Spectrum', confidence: 0.6, rationale_short: 'Major cable internet provider' },
        { display_name: 'Verizon Fios', confidence: 0.5, rationale_short: 'Fiber internet in select East Coast markets' },
        { display_name: 'Google Fiber', confidence: 0.4, rationale_short: 'Fiber internet in select cities' },
    ],
    cable: [
        { display_name: 'Xfinity (Comcast)', confidence: 0.6, rationale_short: 'Largest cable TV provider in the US' },
        { display_name: 'Spectrum', confidence: 0.6, rationale_short: 'Major cable TV provider' },
        { display_name: 'Cox Communications', confidence: 0.5, rationale_short: 'Cable provider in select markets' },
        { display_name: 'Optimum (Altice)', confidence: 0.4, rationale_short: 'Cable provider in the Northeast' },
    ],
};

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate phone number format
 * Returns true if valid US phone format, false otherwise
 */
function isValidPhone(phone: string | undefined | null): boolean {
    if (!phone) return false;
    // Match common US phone formats: (XXX) XXX-XXXX, XXX-XXX-XXXX, 1-XXX-XXX-XXXX, etc.
    const phoneRegex = /^[\d\s\-\(\)\.+]{10,20}$/;
    const hasEnoughDigits = (phone.match(/\d/g) || []).length >= 10;
    return phoneRegex.test(phone) && hasEnoughDigits;
}

/**
 * Validate URL format
 * Returns true if valid URL, false otherwise
 */
function isValidUrl(url: string | undefined | null): boolean {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Clean and validate provider suggestion
 * Filters out invalid contact info
 */
function validateSuggestion(s: ProviderSuggestion, category: UtilityCategory): ProviderSuggestion {
    return {
        display_name: s.display_name,
        confidence: Math.max(0, Math.min(1, s.confidence)),
        rationale_short: s.rationale_short || `${category} provider for this area`,
        contact_phone: isValidPhone(s.contact_phone) ? s.contact_phone : undefined,
        contact_website: isValidUrl(s.contact_website) ? s.contact_website : undefined,
    };
}

// ============================================================================
// Category Guidance
// ============================================================================

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
            return `Propane is delivered by LOCAL fuel delivery companies, NOT utilities. These are often regional or family-owned businesses. Look for propane delivery companies that serve this specific area/county. Examples include AmeriGas, Ferrellgas, Suburban Propane, or local companies.`;
        case 'oil':
            return `Heating oil is delivered by LOCAL fuel delivery companies, NOT utilities. These are often regional or family-owned businesses that deliver heating oil. Look for heating oil delivery companies that serve this specific area, especially common in the Northeast US.`;
        case 'internet':
            return `Internet service providers (ISPs) include major carriers like Xfinity/Comcast, AT&T, Verizon Fios, Spectrum, Cox, CenturyLink, Google Fiber, and regional providers. List the major ISPs that provide service to this address area.`;
        case 'cable':
            return `Cable TV providers are often the same as internet providers. Major cable companies include Xfinity/Comcast, Spectrum, Cox, Optimum, and regional cable companies. Note: DirecTV and Dish are satellite, not cable.`;
        default:
            return `Look for utility providers that serve this area.`;
    }
}

// ============================================================================
// Prompt Building
// ============================================================================

function buildSuggestionPrompt(address: string, category: UtilityCategory): string {
    const categoryGuidance = getCategoryGuidance(category);

    return `You are an expert on utility providers in the United States.

Given the following property address and utility category, identify the most likely utility providers that serve this location.

Address: ${address}
Utility Category: ${category}

IMPORTANT GUIDANCE FOR ${category.toUpperCase()}:
${categoryGuidance}

Return a JSON array of provider suggestions. Each object must have exactly these fields:
- "display_name": string - The official name of the utility provider
- "confidence": number - A value between 0 and 1 indicating confidence (1 = very confident)
- "rationale_short": string - A brief explanation of why this provider serves this area
- "contact_phone": string or null - Customer service phone in format "(XXX) XXX-XXXX"
- "contact_website": string or null - Provider website URL starting with "https://"

RULES:
1. Return 3-5 likely providers, ordered by confidence (highest first).
2. List the dominant provider first, then include 2-3 alternatives with slightly lower confidence.
3. Only include providers you are reasonably confident serve this specific area.
4. If you are uncertain about providers for this area, return an empty array: []
5. For phone numbers, only include numbers you are confident are correct. Use null if unsure.
6. For websites, only include URLs you are confident are correct. Use null if unsure.

Example response:
[
  {
    "display_name": "Duke Energy",
    "confidence": 0.9,
    "rationale_short": "Major electric provider in North Carolina",
    "contact_phone": "(800) 777-9898",
    "contact_website": "https://www.duke-energy.com"
  }
]`;
}

function buildSearchPrompt(query: string, category?: UtilityCategory, address?: string): string {
    const categoryHint = category ? getCategoryGuidance(category) : '';
    const locationContext = address ? `\nLocation Context: The user is filling out a form for property at: ${address}` : '';

    return `You are an expert on utility providers in the United States.

A user is searching for a utility provider matching their query.

Query: "${query}"
${category ? `Expected Category: ${category}` : ''}
${categoryHint ? `\nCategory Context: ${categoryHint}` : ''}${locationContext}

Find utility providers matching this query. Return a JSON array of up to 5 provider suggestions.

Each object must have exactly these fields:
- "display_name": string - The official name of the utility provider
- "confidence": number - A value between 0 and 1 indicating relevance to the query
- "rationale_short": string - Brief explanation of who they are and where they serve
- "contact_phone": string or null - Customer service phone in format "(XXX) XXX-XXXX"
- "contact_website": string or null - Provider website URL starting with "https://"

RULES:
1. Only include real utility providers that match the search query.
2. If no providers match the query, return an empty array: []
3. ${address ? 'Prioritize providers that serve the location context provided.' : 'Include providers from various regions if the query is a common provider name.'}
4. For phone/website, only include if you are confident they are correct. Use null if unsure.`;
}

// ============================================================================
// AI Suggestions
// ============================================================================

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

    // Validate and normalize responses
    return result
        .filter(s => s.display_name && typeof s.confidence === 'number')
        .map(s => validateSuggestion(s, category));
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get provider suggestions based on address and category
 * Uses Gemini AI with fallback to curated provider list
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

    // Try AI first
    let suggestions = await getAISuggestions(address, category);

    if (suggestions && suggestions.length > 0) {
        console.log(`[Suggestions] Got ${suggestions.length} AI suggestions for ${category} at ${address}`);
    } else {
        // Fallback to curated providers
        console.log(`[Suggestions] AI returned no results for ${category}, using fallback providers`);
        suggestions = FALLBACK_PROVIDERS[category] || [];
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
 * Now accepts optional address for location-aware results
 */
export async function searchProviders(
    query: string,
    category?: UtilityCategory,
    address?: string
): Promise<ProviderSuggestion[]> {
    if (!isGeminiConfigured() || query.length < 2) {
        return [];
    }

    const prompt = buildSearchPrompt(query, category, address);
    const result = await generateJSON<ProviderSuggestion[]>(prompt);

    if (!result || !Array.isArray(result)) {
        return [];
    }

    return result
        .filter(s => s.display_name && typeof s.confidence === 'number')
        .map(s => validateSuggestion(s, category || 'electric'));
}
