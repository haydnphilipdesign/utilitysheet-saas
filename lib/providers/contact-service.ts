import { ProviderContact } from '@/types';
import { generateJSON, isGeminiConfigured } from '@/lib/ai/gemini-client';
import { MOCK_PROVIDERS } from './mock-data';

// Contact cache
const contactCache = new Map<string, { contact: ProviderContact | null; timestamp: number }>();
const CACHE_TTL = 90 * 24 * 60 * 60 * 1000; // 90 days in ms

// AI prompt for contact resolution
function buildContactPrompt(providerName: string): string {
    return `You are an expert on utility providers in the United States.

Find the contact information for the following utility provider:

Provider Name: ${providerName}

Respond with a JSON object containing the following fields (use null if unknown):
- customer_service_phone: The main customer service phone number (format: "1-XXX-XXX-XXXX" or "XXX-XXX-XXXX")
- start_stop_service_url: The URL where customers can start or stop service
- main_website: The provider's main website URL
- hours: Customer service hours if known (e.g., "Mon-Fri 8am-6pm EST")

Example response format:
{
  "customer_service_phone": "1-800-777-9898",
  "start_stop_service_url": "https://www.duke-energy.com/start-stop",
  "main_website": "https://www.duke-energy.com",
  "hours": "24/7"
}

Respond ONLY with the JSON object, no additional text.`;
}

/**
 * Get contact info using Gemini AI
 * Returns null if AI is unavailable or fails
 */
async function getAIContact(providerName: string): Promise<ProviderContact | null> {
    if (!isGeminiConfigured()) {
        return null;
    }

    const prompt = buildContactPrompt(providerName);
    const result = await generateJSON<ProviderContact>(prompt);

    if (!result) {
        return null;
    }

    // Normalize the response - convert empty strings to undefined
    return {
        customer_service_phone: result.customer_service_phone || undefined,
        start_stop_service_url: result.start_stop_service_url || undefined,
        main_website: result.main_website || undefined,
        hours: result.hours || undefined,
    };
}

/**
 * Get fallback contact info from mock data
 */
function getMockContact(providerNameOrId: string): ProviderContact | null {
    const provider = MOCK_PROVIDERS.find(
        (p) =>
            p.id === providerNameOrId ||
            p.normalized_name.toLowerCase() === providerNameOrId.toLowerCase() ||
            p.aliases.some((a) => a.toLowerCase() === providerNameOrId.toLowerCase())
    );

    if (!provider) {
        return null;
    }

    return {
        customer_service_phone: provider.contact_phone || undefined,
        start_stop_service_url: provider.contact_urls[0] || undefined,
        main_website: provider.contact_urls[0]?.split('/').slice(0, 3).join('/') || undefined,
    };
}

/**
 * Resolve contact information for a provider
 * Uses Gemini AI when available, falls back to mock data
 */
export async function resolveContact(
    providerNameOrId: string
): Promise<ProviderContact | null> {
    // Check cache
    const cached = contactCache.get(providerNameOrId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.contact;
    }

    // Try AI first, fall back to mock data
    let contact = await getAIContact(providerNameOrId);

    if (!contact || (!contact.customer_service_phone && !contact.start_stop_service_url)) {
        console.log(`[Contact] Using mock data for ${providerNameOrId}`);
        contact = getMockContact(providerNameOrId);
    } else {
        console.log(`[Contact] Got AI contact info for ${providerNameOrId}`);
    }

    contactCache.set(providerNameOrId, { contact, timestamp: Date.now() });

    return contact;
}

/**
 * Resolve contacts for multiple providers at once
 */
export async function resolveContacts(
    providerNames: string[]
): Promise<Record<string, ProviderContact | null>> {
    const results = await Promise.all(
        providerNames.map(async (name) => ({
            name,
            contact: await resolveContact(name),
        }))
    );

    return results.reduce(
        (acc, { name, contact }) => {
            acc[name] = contact;
            return acc;
        },
        {} as Record<string, ProviderContact | null>
    );
}

/**
 * Check if contact resolution succeeded
 */
export function hasValidContact(contact: ProviderContact | null): boolean {
    if (!contact) return false;
    return !!(contact.customer_service_phone || contact.start_stop_service_url);
}
