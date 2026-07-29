import { createHash } from 'crypto';
import { buildLocationContext, parseAddressWithConfidence } from '@/lib/address/location-parser';
import {
    generateJSONWithMeta,
    getGeminiModelName,
    isGeminiConfigured,
} from '@/lib/ai/gemini-client';
import type { JSONFailureReason } from '@/lib/ai/gemini-client';
import {
    AI_REQUEST_FORMAT_VERSION,
    PROVIDER_CONTACT_RESPONSE_SCHEMA,
} from '@/lib/ai/response-schemas';
import { getFromCache, setInCache } from '@/lib/cache';
import { ProviderContact, UtilityCategory } from '@/types';

const POSITIVE_CACHE_TTL_SECONDS = 90 * 24 * 60 * 60;
const NEGATIVE_CACHE_TTL_SECONDS = 5 * 60;
const CONTACT_CACHE_VERSION = 'v2';

type CachedContact = { v: ProviderContact | null };

export interface ContactLookupContext {
    category?: UtilityCategory;
    address?: string | null;
}

export interface ContactResolutionDiagnostic {
    contact: ProviderContact | null;
    failure: JSONFailureReason | null;
    groundingSourceUrls: string[];
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
    const model = sanitizeCacheToken(getGeminiModelName());
    return `contact:${CONTACT_CACHE_VERSION}:${model}:${AI_REQUEST_FORMAT_VERSION}:${mode}:${getContextCacheScope(context)}:${hashCacheKeyPart(providerNameOrId.trim().toLowerCase())}`;
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
function sanitizeContact(result: ProviderContact): ProviderContact {
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

export async function resolveContactFresh(
    providerName: string,
    context?: ContactLookupContext
): Promise<ContactResolutionDiagnostic> {
    if (!isGeminiConfigured()) {
        return {
            contact: null,
            failure: 'provider_error',
            groundingSourceUrls: [],
        };
    }

    const prompt = buildContactPrompt(providerName, context);
    const result = await generateJSONWithMeta<ProviderContact>(prompt, {
        responseJsonSchema: PROVIDER_CONTACT_RESPONSE_SCHEMA,
    });

    if (!result.data) {
        return {
            contact: null,
            failure: result.failure,
            groundingSourceUrls: result.groundingSourceUrls,
        };
    }

    return {
        contact: sanitizeContact(result.data),
        failure: null,
        groundingSourceUrls: result.groundingSourceUrls,
    };
}

async function getAIContact(providerName: string, context?: ContactLookupContext): Promise<ProviderContact | null> {
    const result = await resolveContactFresh(providerName, context);
    return result.contact;
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
    await setInCache(
        cacheKey,
        { v: contact },
        contact ? POSITIVE_CACHE_TTL_SECONDS : NEGATIVE_CACHE_TTL_SECONDS
    );

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
