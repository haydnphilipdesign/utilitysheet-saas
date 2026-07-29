# Provider Resolution Hotfix Implementation Plan

**Status (2026-07-29):** Complete. All focused and full-repository validation passed. Release commit
`3adfc8c` reached `origin/main`; Vercel production deployment
`dpl_4vTrb4Ay7X7BMpXVa9aYAbhsXS6h` reached `READY`, and the nine-category production smoke test passed.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Gemini provider and contact JSON generation schema-backed, observable on empty responses, and safe against long-lived fallback caches.

**Architecture:** Define explicit response schemas and a versioned AI request-format token in focused AI modules. Pass a caller-specific schema into every JSON generation, preserve transport/provider failures through provider quality gates, and choose cache TTLs from the result provenance. Keep the production model default on the restored 3.1 Flash Lite version while the 3.5 request shape is tested.

**Tech Stack:** Next.js 16, TypeScript, `@google/genai` 1.43.0, Zod, Upstash cache abstraction, Vitest.

---

No commit, push, deployment, environment change, cache deletion, or live request is included. The
repository owner must authorize those actions separately.

### Task 1: Lock the structured-output contract with failing Gemini tests

**Files:**
- Create: `lib/ai/response-schemas.ts`
- Modify: `tests/unit/gemini-client.test.ts`
- Modify: `lib/ai/gemini-client.ts`

- [ ] **Step 1: Add failing tests for caller schemas and empty responses**

Add tests that call `generateJSONWithMeta()` with a schema, inspect the SDK request, and simulate a
response without a candidate or text:

```ts
const TEST_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: { name: { type: 'string' } },
    required: ['name'],
};

it('sends caller JSON schema with Google Search grounding', async () => {
    generateContentMock.mockResolvedValue({
        candidates: [{ content: { parts: [{ text: '{"name":"Duke Energy"}' }] } }],
        text: '{"name":"Duke Energy"}',
    });

    const { generateJSONWithMeta } = await import('@/lib/ai/gemini-client');
    await generateJSONWithMeta<{ name: string }>('prompt', {
        responseJsonSchema: TEST_SCHEMA,
    });

    expect(generateContentMock).toHaveBeenCalledWith(expect.objectContaining({
        config: expect.objectContaining({
            responseMimeType: 'application/json',
            responseJsonSchema: TEST_SCHEMA,
            tools: [{ googleSearch: {} }],
        }),
    }));
});

it('classifies a response without candidates or text as provider_error', async () => {
    generateContentMock.mockResolvedValue({ candidates: [], text: undefined });

    const { generateJSONWithMeta } = await import('@/lib/ai/gemini-client');
    const promise = generateJSONWithMeta('prompt', { responseJsonSchema: TEST_SCHEMA });
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toEqual({
        data: null,
        failure: 'provider_error',
        groundingSourceUrls: [],
    });
    expect(generateContentMock).toHaveBeenCalledTimes(3);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
npm test -- tests/unit/gemini-client.test.ts --run
```

Expected: FAIL because `generateJSONWithMeta` does not accept options, does not pass
`responseJsonSchema`, and does not return grounding metadata.

- [ ] **Step 3: Define caller-owned schemas and the request-format version**

Create `lib/ai/response-schemas.ts` with immutable plain JSON schemas:

```ts
export const AI_REQUEST_FORMAT_VERSION = 'structured-json-v2';

const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] } as const;

export const PROVIDER_SUGGESTION_RESPONSE_SCHEMA = {
    type: 'array',
    maxItems: 12,
    items: {
        type: 'object',
        additionalProperties: false,
        properties: {
            display_name: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            rationale_short: nullableString,
            contact_phone: nullableString,
            contact_website: nullableString,
        },
        required: [
            'display_name',
            'confidence',
            'rationale_short',
            'contact_phone',
            'contact_website',
        ],
    },
} as const;

export const PROVIDER_CONTACT_RESPONSE_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        customer_service_phone: nullableString,
        start_stop_service_url: nullableString,
        main_website: nullableString,
        hours: nullableString,
    },
    required: [
        'customer_service_phone',
        'start_stop_service_url',
        'main_website',
        'hours',
    ],
} as const;
```

- [ ] **Step 4: Implement required-schema generation and empty-response retry**

Change the default model and JSON interfaces in `lib/ai/gemini-client.ts`:

```ts
const DEFAULT_MODEL_NAME = 'gemini-3.1-flash-lite';

interface JSONGenerationOptions {
    responseJsonSchema: unknown;
}

export interface JSONGenerationResult<T> {
    data: T | null;
    failure: JSONFailureReason | null;
    groundingSourceUrls: string[];
}
```

Update `getGeminiModel` to accept an optional schema and attach it in JSON mode:

```ts
export function getGeminiModel(
    jsonMode: boolean = false,
    responseJsonSchema?: unknown
) {
    // existing configuration
    if (jsonMode) {
        config.responseMimeType = 'application/json';
        if (responseJsonSchema) config.responseJsonSchema = responseJsonSchema;
    }
    // existing thinking/tools/model return
}
```

Add source extraction and make an empty candidate/text response retryable:

```ts
function getGroundingSourceUrls(response: GenerateContentResponse): string[] {
    return Array.from(new Set(
        (response.candidates || [])
            .flatMap((candidate) => candidate.groundingMetadata?.groundingChunks || [])
            .map((chunk) => chunk.web?.uri)
            .filter((uri): uri is string => Boolean(uri))
    ));
}

function requireResponseText(response: GenerateContentResponse): string {
    const text = response.text?.trim();
    if (!response.candidates?.length || !text) {
        throw new Error('Gemini returned no candidate text');
    }
    return text;
}
```

Require options in both JSON functions and return `{ text, groundingSourceUrls }` from the retry block.
Every error return must include `groundingSourceUrls: []`; success returns the extracted URLs.

- [ ] **Step 5: Run the Gemini tests**

Run:

```powershell
npm test -- tests/unit/gemini-client.test.ts --run
```

Expected: PASS, including the 3.5-compatible Search-plus-schema request assertion and the empty-response
retry/classification assertion.

### Task 2: Pass schemas and preserve provider failures

**Files:**
- Modify: `lib/providers/suggestion-service.ts`
- Modify: `tests/unit/suggestion-service.test.ts`

- [ ] **Step 1: Add failing schema and telemetry-preservation tests**

Extend the Gemini mock result helpers with `groundingSourceUrls: []`. Capture
`createAiSuggestionRun` and assert the caller schema and original upstream failure:

```ts
expect(generateJSONWithMetaMock).toHaveBeenCalledWith(
    expect.any(String),
    { responseJsonSchema: PROVIDER_SUGGESTION_RESPONSE_SCHEMA }
);

generateJSONWithMetaMock
    .mockResolvedValueOnce(providerError())
    .mockResolvedValueOnce(ok([]));

await getSuggestions('123 Main St, Raleigh, NC 27601', 'electric');

expect(createAiSuggestionRunMock).toHaveBeenLastCalledWith(
    expect.objectContaining({
        status: 'error',
        reasonCode: 'fallback_used',
        upstreamReasonCode: 'ai_provider_error',
    })
);
```

- [ ] **Step 2: Add failing cache namespace and fallback-TTL tests**

Mock `getGeminiModelName()` as `gemini-test` and capture `setInCache`:

```ts
expect(__testing.getCacheKey(address, 'electric')).toContain('structured-json-v2');
expect(__testing.getCacheKey(address, 'electric')).toContain('gemini-test');

await getSuggestions(address, 'electric');
expect(setInCacheMock).toHaveBeenCalledWith(
    expect.any(String),
    expect.any(Array),
    5 * 60
);
```

Add a successful AI case asserting the existing 30-day suggestion TTL and a search fallback case
asserting five minutes rather than seven days.

- [ ] **Step 3: Run the focused test and verify failure**

Run:

```powershell
npm test -- tests/unit/suggestion-service.test.ts --run
```

Expected: FAIL on missing schema argument, old cache namespaces, overwritten upstream reason, and long
fallback TTLs.

- [ ] **Step 4: Implement schema calls and versioned cache namespaces**

Import the schema and request-format version. Derive a stable token:

```ts
const FALLBACK_CACHE_TTL_SECONDS = 5 * 60;
const SUGGESTION_CACHE_VERSION = 'v7';
const SEARCH_CACHE_VERSION = 'v7';

function getAiCacheToken(): string {
    return hashCacheKeyPart(`${getGeminiModelName()}:${AI_REQUEST_FORMAT_VERSION}`);
}
```

Include `getAiCacheToken()` in suggestion and search keys after their cache versions. Pass the provider
array schema from `runAiPass()`:

```ts
const response = await generateJSONWithMeta<unknown>(prompt, {
    responseJsonSchema: PROVIDER_SUGGESTION_RESPONSE_SCHEMA,
});
```

- [ ] **Step 5: Preserve provider/parse failures through later quality gates**

Add a single merge helper and use it everywhere `upstreamReason` is updated:

```ts
function mergeUpstreamReason(
    current: SuggestionReasonCode | null,
    next: SuggestionReasonCode | null
): SuggestionReasonCode | null {
    if (!next) return current;
    if (
        current === 'ai_provider_error' ||
        current === 'ai_parse_error' ||
        current === 'ai_unconfigured'
    ) {
        return current;
    }
    return next;
}
```

Replace assignments such as `upstreamReason = primaryGate.reasonCode` with
`upstreamReason = mergeUpstreamReason(upstreamReason, primaryGate.reasonCode)`.

- [ ] **Step 6: Select cache TTL from pipeline provenance**

Keep the whole `PipelineResult` until cache write:

```ts
const result = await runSuggestionPipeline(address, category, context);
await setInCache(
    cacheKey,
    result.suggestions,
    result.outcome.source === 'fallback'
        ? FALLBACK_CACHE_TTL_SECONDS
        : CACHE_TTL_SECONDS
);
return result.suggestions;
```

Apply the same rule to search, using `SEARCH_CACHE_TTL_SECONDS` for non-fallback results.

- [ ] **Step 7: Run provider tests**

Run:

```powershell
npm test -- tests/unit/suggestion-service.test.ts tests/unit/ai-telemetry.test.ts --run
```

Expected: PASS.

### Task 3: Separate positive and negative contact caching

**Files:**
- Modify: `lib/providers/contact-service.ts`
- Modify: `tests/unit/contact-service.test.ts`

- [ ] **Step 1: Write failing contact schema and TTL tests**

Mock `generateJSONWithMeta` instead of `generateJSON`. Assert:

```ts
expect(generateJSONWithMetaMock).toHaveBeenCalledWith(
    expect.any(String),
    { responseJsonSchema: PROVIDER_CONTACT_RESPONSE_SCHEMA }
);
```

Add a null result test asserting a five-minute cache write, a usable result test asserting 90 days, and
a key assertion containing the model/request-format namespace.

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
npm test -- tests/unit/contact-service.test.ts --run
```

Expected: FAIL because contact generation has no schema or failure metadata and uses one 90-day TTL.

- [ ] **Step 3: Implement contact schema, cache versioning, and negative TTL**

Use:

```ts
const POSITIVE_CACHE_TTL_SECONDS = 90 * 24 * 60 * 60;
const NEGATIVE_CACHE_TTL_SECONDS = 5 * 60;
const CONTACT_CACHE_VERSION = 'v2';
```

Include a hash of model plus `AI_REQUEST_FORMAT_VERSION` in `toCacheKey()`. Change `getAIContact()` to
call:

```ts
const result = await generateJSONWithMeta<ProviderContact>(prompt, {
    responseJsonSchema: PROVIDER_CONTACT_RESPONSE_SCHEMA,
});
if (!result.data) return null;
```

Cache with:

```ts
await setInCache(
    cacheKey,
    { v: contact },
    contact ? POSITIVE_CACHE_TTL_SECONDS : NEGATIVE_CACHE_TTL_SECONDS
);
```

- [ ] **Step 4: Run contact and Gemini tests**

Run:

```powershell
npm test -- tests/unit/contact-service.test.ts tests/unit/gemini-client.test.ts --run
```

Expected: PASS.

### Task 4: Validate the hotfix as one unit

**Files:**
- Modify: `docs/ai-telemetry.md`
- Modify: `.ai/CURRENT.md`
- Modify: `.ai/plans/2026-07-29-provider-contact-resolution-incident.md`

- [ ] **Step 1: Document the structured-output and cache behavior**

Add a short failure-behavior section stating that every JSON caller supplies a schema, no-candidate
responses are `provider_error`, cache namespaces include model/request format, and only positive results
receive long TTLs.

- [ ] **Step 2: Run the focused incident suite**

Run:

```powershell
npm test -- tests/unit/gemini-client.test.ts tests/unit/suggestion-service.test.ts tests/unit/contact-service.test.ts tests/unit/ai-telemetry.test.ts tests/unit/seller-suggestions-route.test.ts tests/unit/seller-suggestions-search-route.test.ts --run
```

Expected: PASS.

- [ ] **Step 3: Run static validation**

Run:

```powershell
npm exec tsc -- --noEmit
npm exec eslint -- lib/ai/gemini-client.ts lib/ai/response-schemas.ts lib/providers/suggestion-service.ts lib/providers/contact-service.ts tests/unit/gemini-client.test.ts tests/unit/suggestion-service.test.ts tests/unit/contact-service.test.ts
git diff --check
```

Expected: all commands PASS. If repository-wide baseline lint is later run, report unrelated existing
findings separately.

- [ ] **Step 4: Update durable handoff**

Record exact changed files, test results, remaining deployment/smoke-test requirements, and that
production remains on `gemini-3.1-flash-lite`. Do not claim deployment or cache invalidation.
