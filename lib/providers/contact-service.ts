import { randomUUID } from 'crypto';
import { z } from 'zod';
import { emptyTransport, originMetadataSchema, type OriginMetadata, type TransportSummary } from '@/lib/telemetry/ai-lineage';
import { exposeGeneration, type GenerationHandle } from '@/lib/neon/queries/ai-lineage';
import { logDiagnostic } from '@/lib/telemetry/diagnostics';
import { createHash } from 'crypto';
import { buildLocationContext, parseAddressWithConfidence } from '@/lib/address/location-parser';
import {
    generateJSONWithMeta,
    getGeminiModelName,
    getGeminiThinkingLevelName,
    isGeminiConfigured,
} from '@/lib/ai/gemini-client';
import type { GeminiFailureKind, GeminiUsage, JSONFailureReason } from '@/lib/ai/gemini-client';
import {
    AI_REQUEST_FORMAT_VERSION,
    PROVIDER_CONTACT_RESPONSE_SCHEMA,
} from '@/lib/ai/response-schemas';
import { getFromCache, setInCache } from '@/lib/cache';
import type { CreateAiSuggestionRunInput } from '@/lib/neon/queries/ai-telemetry';
import { ProviderContact, UtilityCategory } from '@/types';

const POSITIVE_CACHE_TTL_SECONDS = 90 * 24 * 60 * 60;
const NEGATIVE_CACHE_TTL_SECONDS = 5 * 60;
const CONTACT_CACHE_VERSION = 'v4';
const CONTACT_PROMPT_VERSION = 'provider-contact-v1';

const cachedContactSchema = z.object({ v: z.literal(1), contact: z.object({
    customer_service_phone: z.string().max(200).optional(), start_stop_service_url: z.string().max(2000).optional(),
    main_website: z.string().max(2000).optional(), hours: z.string().max(500).optional(),
}).strict().nullable(), origin: originMetadataSchema, runId: z.string().uuid().nullable() }).strict();
type CachedContact = z.infer<typeof cachedContactSchema>;

export interface ContactLookupContext {
    editVersion?: number;
    mode?: 'live' | 'test';
    category?: UtilityCategory;
    address?: string | null;
    /** Only used to link the telemetry row; never part of the prompt or cache key. */
    requestId?: string;
    accountId?: string;
    organizationId?: string | null;
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
    // State + full ZIP + city, the locality the prompt uses to tell apart
    // same-named boroughs, townships and authorities.
    const state = sanitizeCacheToken(parsed.state);
    const zip = parsed.zip ? sanitizeCacheToken(parsed.zip) : 'nozip';
    const city = sanitizeCacheToken(parsed.city);
    return `${category}:${state}:${zip}:${city}`;
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

interface ContactLookup extends ContactResolutionDiagnostic {
    transport?: TransportSummary;
    usage: GeminiUsage | null;
    errorKind: GeminiFailureKind | null;
    /** Model calls made: 0 when AI is not configured. */
    attemptCount: number;
}

async function lookUpContact(
    providerName: string,
    context?: ContactLookupContext
): Promise<ContactLookup> {
    if (!isGeminiConfigured()) {
        return {
            contact: null,
            failure: 'provider_error',
            groundingSourceUrls: [],
            usage: null,
            transport: emptyTransport('unconfigured'),
            errorKind: 'unconfigured',
            attemptCount: 0,
        };
    }

    const prompt = buildContactPrompt(providerName, context);
    const result = await generateJSONWithMeta<ProviderContact>(prompt, {
        responseJsonSchema: PROVIDER_CONTACT_RESPONSE_SCHEMA,
        passRole: 'contact',
    });
    const usage = result.usage ?? null;

    if (!result.data) {
        return {
            contact: null,
            failure: result.failure,
            groundingSourceUrls: result.groundingSourceUrls,
            transport: result.transport,
            usage,
            errorKind: result.failure === 'provider_error' ? result.failureKind ?? 'api_error' : null,
            attemptCount: 1,
        };
    }

    return {
        contact: sanitizeContact(result.data),
        failure: null,
        groundingSourceUrls: result.groundingSourceUrls,
        transport: result.transport,
        usage,
        errorKind: result.failureKind ?? null,
        attemptCount: 1,
    };
}

/**
 * Run a fresh contact lookup for incident/support review. This intentionally
 * bypasses the cache and AI telemetry.
 */
export async function resolveContactFresh(
    providerName: string,
    context?: ContactLookupContext
): Promise<ContactResolutionDiagnostic> {
    const { contact, failure, groundingSourceUrls } = await lookUpContact(providerName, context);
    return { contact, failure, groundingSourceUrls };
}

/**
 * One telemetry row per contact lookup. The provider name is not stored; a
 * failed write never affects the lookup.
 */
function contactHandle(lookup: ContactLookup | null, context: ContactLookupContext | undefined, startedAt: number): GenerationHandle {
    const parsed = context?.address ? parseAddressWithConfidence(context.address) : null;
    const disabled = lookup === null;
    const reason = disabled ? null : lookup.failure === 'parse_error' ? 'ai_parse_error'
        : lookup.failure === 'provider_error' ? lookup.errorKind === 'unconfigured' ? 'ai_unconfigured' : 'ai_provider_error'
        : hasValidContact(lookup.contact) ? null : 'ai_empty';
    const origin: OriginMetadata = { v: 1, lineageVersion: 2, source: disabled ? 'disabled' : 'ai_primary',
        status: lookup?.failure === 'parse_error' ? 'parse_error' : lookup?.failure === 'provider_error' ? 'error' : 'success',
        reason, upstreamReason: null, listKind: 'no_list', model: getGeminiModelName(), promptVersion: CONTACT_PROMPT_VERSION,
        requestFormat: AI_REQUEST_FORMAT_VERSION, thinkingLevel: lookup?.attemptCount ? getGeminiThinkingLevelName() : null,
        producedAt: new Date().toISOString() };
    const input: CreateAiSuggestionRunInput = {
        id: randomUUID(), cacheHit: false, lineageVersion: 2, transport: disabled ? emptyTransport('disabled') : lookup.transport,
        requestId: context?.requestId, accountId: context?.accountId, organizationId: context?.organizationId ?? null,
        feature: 'provider_contact', category: context?.category ?? null, provider: 'gemini', model: origin.model,
        promptVersion: CONTACT_PROMPT_VERSION, servedPipeline: null, source: origin.source, status: origin.status,
        reasonCode: reason, upstreamReasonCode: null, latencyMs: Date.now()-startedAt, attemptCount: lookup?.attemptCount ?? 0,
        localityState: parsed?.state ?? null, localityZip3: parsed?.zip?.slice(0,3) ?? null, localityCity: parsed?.city ?? null,
        suggestionCount: hasValidContact(lookup?.contact ?? null) ? 1 : 0, suggestions: [], usage: lookup?.usage ?? null,
        thinkingLevel: origin.thinkingLevel, errorKind: lookup?.errorKind ?? null,
    };
    return { input, origin, runId: null, itemIds: [] };
}
async function exposeContact(handle: GenerationHandle, context: ContactLookupContext | undefined, delivery: 'fresh' | 'cache', startedAt: number) {
    return exposeGeneration(handle, context?.requestId ? { requestId: context.requestId, editVersion: context.editVersion ?? 0,
        mode: context.mode ?? 'live', feature: 'provider_contact', category: context.category ?? null } : undefined, delivery, startedAt);
}
/** Functional contact policy is unchanged; cache retains positive/negative producing metadata. */
export async function resolveContact(providerNameOrId: string, context?: ContactLookupContext): Promise<ProviderContact | null> {
    const startedAt = Date.now();
    if (!shouldAllowUnverifiedAiContacts()) {
        await exposeContact(contactHandle(null,context,startedAt),context,'fresh',startedAt);
        return null;
    }
    const cacheKey = toCacheKey(providerNameOrId,context);
    const cached = cachedContactSchema.safeParse(await getFromCache<CachedContact>(cacheKey));
    if (cached.success) {
        const handle: GenerationHandle = { input: { suggestions: [] } as unknown as CreateAiSuggestionRunInput,
            origin: cached.data.origin, runId: cached.data.runId, itemIds: [] };
        await exposeContact(handle,context,'cache',startedAt);
        return cached.data.contact;
    }
    const lookup = await lookUpContact(providerNameOrId,context);
    const handle = contactHandle(lookup,context,startedAt);
    await exposeContact(handle,context,'fresh',startedAt);
    if (lookup.contact) logDiagnostic('log','contact_resolved',{ category: context?.category });
    await setInCache(cacheKey,{ v: 1, contact: lookup.contact, origin: handle.origin, runId: handle.runId } satisfies CachedContact,
        lookup.contact ? POSITIVE_CACHE_TTL_SECONDS : NEGATIVE_CACHE_TTL_SECONDS);
    return lookup.contact;
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
