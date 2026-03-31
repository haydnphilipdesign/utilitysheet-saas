import { createHash } from 'crypto';
import { buildLocationContext, parseAddressWithConfidence } from '@/lib/address/location-parser';
import { generateJSON, isGeminiConfigured } from '@/lib/ai/gemini-client';
import { getFromCache, setInCache } from '@/lib/cache';
import { ProviderContact, UtilityCategory } from '@/types';

// Cache TTL: 90 days in seconds
const CACHE_TTL_SECONDS = 90 * 24 * 60 * 60;

type CachedContact = { v: ProviderContact | null };

export interface ContactLookupContext {
    category?: UtilityCategory;
    address?: string | null;
}

function shouldAllowUnverifiedAiContacts(): boolean {
    return process.env.ALLOW_UNVERIFIED_AI_CONTACTS !== 'false';
}

function hashCacheKeyPart(input: string): string {
    return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

function sanitizeCacheToken(input: string | null | undefined): string {
    if (!input) return 'unknown';
    const normalized = input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return normalized || 'unknown';
}

function getContextCacheScope(context?: ContactLookupContext): string {
    const category = context?.category || 'any';
    if (!context?.address) {
        return `${category}:global`;
    }

    const parsed = parseAddressWithConfidence(context.address);
    const state = sanitizeCacheToken(parsed.state);
    const locality = sanitizeCacheToken(parsed.zip ? parsed.zip.slice(0, 3) : parsed.city);
    return `${category}:${state}:${locality}`;
}

function toCacheKey(providerNameOrId: string, context?: ContactLookupContext): string {
    const mode = shouldAllowUnverifiedAiContacts() ? 'ai' : 'strict';
    return `contact:${mode}:${getContextCacheScope(context)}:${hashCacheKeyPart(providerNameOrId.trim().toLowerCase())}`;
}

function safeHttpUrl(value: string | undefined): string | undefined {
    if (!value) return undefined;
    try {
        const parsed = new URL(value);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
        return parsed.toString();
    } catch {
        return undefined;
    }
}

// AI prompt for contact resolution
function buildContactPrompt(providerName: string, context?: ContactLookupContext): string {
    const parsed = context?.address ? parseAddressWithConfidence(context.address) : null;
    const location = parsed ? buildLocationContext(parsed) : null;
    const locationBlock = location?.lines?.length
        ? `\nLocation Context (non-PII):\n${location.lines.join('\n')}\nLocation Confidence: ${parsed?.confidence}`
        : '';
    const categoryBlock = context?.category
        ? `\nUtility Category: ${context.category}`
        : '';

    return `You are an expert on utility providers in the United States.

Find the contact information for the following utility provider:

Provider Name: ${providerName}
${categoryBlock}${locationBlock}

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

Rules:
- Use the utility category and location context to disambiguate similarly named municipalities, townships, and authorities.
- Prefer official provider or government service pages for the exact utility category.
- If the provider name is ambiguous for this location, return null fields instead of guessing.
- Do not return a general township phone if a separate authority or department handles this utility category.

Respond ONLY with the JSON object, no additional text.`;
}

/**
 * Get contact info using Gemini AI
 * Returns null if AI is unavailable or fails
 */
async function getAIContact(providerName: string, context?: ContactLookupContext): Promise<ProviderContact | null> {
    if (!isGeminiConfigured()) {
        return null;
    }

    const prompt = buildContactPrompt(providerName, context);
    const result = await generateJSON<ProviderContact>(prompt);

    if (!result) {
        return null;
    }

    // Normalize and sanitize response
    const customerServicePhone = result.customer_service_phone || undefined;
    const startStopServiceUrl = safeHttpUrl(result.start_stop_service_url || undefined);
    const mainWebsite = safeHttpUrl(result.main_website || undefined);

    return {
        customer_service_phone: customerServicePhone,
        start_stop_service_url: startStopServiceUrl,
        main_website: mainWebsite,
        hours: result.hours || undefined,
    };
}

/**
 * Resolve contact information for a provider
 * Uses Gemini AI only when ALLOW_UNVERIFIED_AI_CONTACTS=true
 */
export async function resolveContact(
    providerNameOrId: string,
    context?: ContactLookupContext
): Promise<ProviderContact | null> {
    if (!shouldAllowUnverifiedAiContacts()) {
        return null;
    }

    const cacheKey = toCacheKey(providerNameOrId, context);

    // Check cache (Redis with in-memory fallback)
    const cached = await getFromCache<CachedContact>(cacheKey);
    if (cached) {
        return cached.v;
    }

    // Try AI first
    const contact = await getAIContact(providerNameOrId, context);

    if (contact) {
        console.log(`[Contact] Got AI contact info for ${providerNameOrId}`);
    }

    // Cache result (including null) to avoid repeated lookups
    await setInCache(cacheKey, { v: contact }, CACHE_TTL_SECONDS);

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
