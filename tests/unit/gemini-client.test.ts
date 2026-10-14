import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const generateContentMock = vi.hoisted(() => vi.fn());
const GoogleGenAIMock = vi.hoisted(() => vi.fn(function MockGoogleGenAI() {
    return {
        models: {
            generateContent: generateContentMock,
        },
    };
}));

vi.mock('@google/genai', () => ({
    GoogleGenAI: GoogleGenAIMock,
}));

describe('gemini-client grounding config', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        vi.resetModules();
        vi.useRealTimers();
        generateContentMock.mockReset();
        GoogleGenAIMock.mockReset();
        GoogleGenAIMock.mockImplementation(function MockGoogleGenAI() {
            return {
                models: {
                    generateContent: generateContentMock,
                },
            };
        });

        process.env.GOOGLE_AI_API_KEY = 'test-api-key';
        delete process.env.GEMINI_GOOGLE_SEARCH_GROUNDING;
        delete process.env.GEMINI_GROUNDING_DYNAMIC_THRESHOLD;
        delete process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_MODEL_NAME;
        delete process.env.GEMINI_THINKING_LEVEL;
    });

    afterEach(() => {
        vi.useRealTimers();
        process.env = { ...originalEnv };
    });

    it('enables Google Search grounding by default for JSON generation', async () => {
        const { getGeminiModel } = await import('@/lib/ai/gemini-client');
        const modelParams = getGeminiModel(true);

        expect(GoogleGenAIMock).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
        expect(modelParams?.model).toBe('gemini-3.1-flash-lite');
        expect(modelParams?.config.responseMimeType).toBe('application/json');
        expect(modelParams?.config.tools).toEqual([
            {
                googleSearch: {},
            },
        ]);
    });

    it('allows explicitly disabling grounding', async () => {
        process.env.GEMINI_GOOGLE_SEARCH_GROUNDING = 'false';

        const { getGeminiModel } = await import('@/lib/ai/gemini-client');
        const modelParams = getGeminiModel(false);
        expect(modelParams?.config.tools).toBeUndefined();
    });

    it('passes a caller-specific JSON schema alongside Google Search grounding', async () => {
        const schema = {
            type: 'object',
            additionalProperties: false,
            properties: {
                name: { type: 'string' },
            },
            required: ['name'],
        };
        generateContentMock.mockResolvedValue({
            candidates: [{
                content: {
                    parts: [{ text: '{"name":"Duke Energy"}' }],
                },
                groundingMetadata: {
                    groundingChunks: [{
                        web: { uri: 'https://example.com/source' },
                    }],
                },
            }],
            text: '{"name":"Duke Energy"}',
        });

        const { generateJSONWithMeta } = await import('@/lib/ai/gemini-client');
        const result = await generateJSONWithMeta<{ name: string }>('prompt', {
            responseJsonSchema: schema,
        });

        expect(generateContentMock).toHaveBeenCalledWith(expect.objectContaining({
            config: expect.objectContaining({
                responseMimeType: 'application/json',
                responseJsonSchema: schema,
                tools: [{ googleSearch: {} }],
            }),
        }));
        expect(result).toMatchObject({
            data: { name: 'Duke Energy' },
            failure: null,
            groundingSourceUrls: ['https://example.com/source'],
            usage: {
                promptTokens: null,
                outputTokens: null,
                thinkingTokens: null,
                toolPromptTokens: null,
                searchQueryCount: null,
                sourceCount: 1,
            },
            failureKind: null,
        });
    });

    it.each([
        [undefined, null, null],
        [{ webSearchQueries: [], groundingChunks: [] }, 0, 0],
        [{ webSearchQueries: ['synthetic query'] }, 1, null],
    ])('distinguishes omitted grounding metadata from explicit empty arrays: %j', async (groundingMetadata, queries, sources) => {
        generateContentMock.mockResolvedValue({ text: '{}', candidates: [{
            content: { parts: [{ text: '{}' }] }, groundingMetadata,
        }] });
        const { generateJSONWithMeta } = await import('@/lib/ai/gemini-client');
        expect((await generateJSONWithMeta('prompt', { responseJsonSchema: {} })).usage)
            .toMatchObject({ searchQueryCount: queries, sourceCount: sources });
    });

    it('does not call partially covered candidates complete grounding metadata', async () => {
        generateContentMock.mockResolvedValue({ text: '{}', candidates: [
            { content: { parts: [{ text: '{}' }] }, groundingMetadata: { webSearchQueries: ['fixture'], groundingChunks: [] } },
            { content: { parts: [{ text: '{}' }] } },
        ] });
        const { generateJSONWithMeta } = await import('@/lib/ai/gemini-client');
        expect((await generateJSONWithMeta('prompt', { responseJsonSchema: {} })).usage)
            .toMatchObject({ searchQueryCount: null, sourceCount: null });
    });

    it('reports tokens, search queries and distinct sources of the answer', async () => {
        generateContentMock.mockResolvedValue({
            candidates: [{
                content: { parts: [{ text: '{"name":"Duke Energy"}' }] },
                groundingMetadata: {
                    webSearchQueries: ['duke energy raleigh', 'raleigh electric utility'],
                    groundingChunks: [
                        { web: { uri: 'https://example.com/a' } },
                        { web: { uri: 'https://example.com/a' } },
                        { web: { uri: 'https://example.com/b' } },
                    ],
                },
            }],
            text: '{"name":"Duke Energy"}',
            usageMetadata: {
                promptTokenCount: 412,
                candidatesTokenCount: 58,
                thoughtsTokenCount: 120,
                toolUsePromptTokenCount: 1900,
                totalTokenCount: 2490,
            },
        });

        const { generateJSONWithMeta } = await import('@/lib/ai/gemini-client');
        const result = await generateJSONWithMeta<{ name: string }>('prompt', { responseJsonSchema: {} });

        expect(result.usage).toEqual({
            promptTokens: 412,
            outputTokens: 58,
            thinkingTokens: 120,
            toolPromptTokens: 1900,
            searchQueryCount: 2,
            sourceCount: 2,
        });
    });

    it('keeps the usage of an answer that could not be parsed', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        generateContentMock.mockResolvedValue({
            candidates: [{ content: { parts: [{ text: 'not json' }] } }],
            text: 'not json',
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 3 },
        });

        const { generateJSONWithMeta } = await import('@/lib/ai/gemini-client');
        const result = await generateJSONWithMeta<unknown>('prompt', { responseJsonSchema: {} });

        expect(result).toMatchObject({
            failure: 'parse_error',
            failureKind: null,
            usage: { promptTokens: 10, outputTokens: 3, searchQueryCount: null },
        });
    });

    it('names the thinking level that is sent, or default when none is', async () => {
        const first = await import('@/lib/ai/gemini-client');
        expect(first.getGeminiThinkingLevelName()).toBe('default');

        vi.resetModules();
        process.env.GEMINI_THINKING_LEVEL = 'low';
        const second = await import('@/lib/ai/gemini-client');
        expect(second.getGeminiThinkingLevelName()).toBe('low');

        vi.resetModules();
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        process.env.GEMINI_THINKING_LEVEL = 'turbo';
        const third = await import('@/lib/ai/gemini-client');
        expect(third.getGeminiThinkingLevelName()).toBe('default');
    });

    it('reports a missing API key as unconfigured', async () => {
        delete process.env.GOOGLE_AI_API_KEY;
        vi.spyOn(console, 'log').mockImplementation(() => undefined);

        const { generateJSONWithMeta } = await import('@/lib/ai/gemini-client');
        const result = await generateJSONWithMeta<unknown>('prompt', { responseJsonSchema: {} });

        expect(result).toMatchObject({ failure: 'provider_error', failureKind: 'unconfigured', usage: null });
    });

    it('warns once and ignores deprecated grounding threshold when provided', async () => {
        process.env.GEMINI_GROUNDING_DYNAMIC_THRESHOLD = '0.42';
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        const { getGeminiModel } = await import('@/lib/ai/gemini-client');
        const first = getGeminiModel(false);
        const second = getGeminiModel(false);

        expect(first?.config.tools).toEqual([{ googleSearch: {} }]);
        expect(second?.config.tools).toEqual([{ googleSearch: {} }]);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith(
            '[Gemini] GEMINI_GROUNDING_DYNAMIC_THRESHOLD is deprecated and ignored when using googleSearch grounding.'
        );
    });

    it('uses GEMINI_API_KEY fallback when GOOGLE_AI_API_KEY is missing', async () => {
        delete process.env.GOOGLE_AI_API_KEY;
        process.env.GEMINI_API_KEY = 'fallback-key';

        const { getGeminiModel, isGeminiConfigured } = await import('@/lib/ai/gemini-client');
        const modelParams = getGeminiModel(false);

        expect(isGeminiConfigured()).toBe(true);
        expect(GoogleGenAIMock).toHaveBeenCalledWith({ apiKey: 'fallback-key' });
        expect(modelParams?.model).toBe('gemini-3.1-flash-lite');
    });

    it('allows overriding the Gemini model via GEMINI_MODEL_NAME', async () => {
        process.env.GEMINI_MODEL_NAME = 'gemini-3-flash-preview';

        const { getGeminiModel } = await import('@/lib/ai/gemini-client');
        const modelParams = getGeminiModel(false);

        expect(modelParams?.model).toBe('gemini-3-flash-preview');
    });

    it('allows setting Gemini thinking level via GEMINI_THINKING_LEVEL', async () => {
        process.env.GEMINI_THINKING_LEVEL = 'low';

        const { getGeminiModel } = await import('@/lib/ai/gemini-client');
        const modelParams = getGeminiModel(false);

        expect(modelParams?.config.thinkingConfig).toEqual({
            thinkingLevel: 'low',
        });
    });

    it('keeps thinking config enabled for Gemini 3 Flash Preview', async () => {
        process.env.GEMINI_MODEL_NAME = 'gemini-3-flash-preview';
        process.env.GEMINI_THINKING_LEVEL = 'low';

        const { getGeminiModel } = await import('@/lib/ai/gemini-client');
        const modelParams = getGeminiModel(false);

        expect(modelParams?.model).toBe('gemini-3-flash-preview');
        expect(modelParams?.config.thinkingConfig).toEqual({
            thinkingLevel: 'low',
        });
    });

    it('omits thinking config for Gemini models that do not support it', async () => {
        process.env.GEMINI_MODEL_NAME = 'gemini-3.1-flash-tts-preview';
        process.env.GEMINI_THINKING_LEVEL = 'low';
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        const { getGeminiModel } = await import('@/lib/ai/gemini-client');
        const modelParams = getGeminiModel(false);

        expect(modelParams?.model).toBe('gemini-3.1-flash-tts-preview');
        expect(modelParams?.config.thinkingConfig).toBeUndefined();
        expect(warnSpy).toHaveBeenCalledWith(
            '[diagnostic] gemini_thinking_unsupported', {}
        );
    });

    it('ignores invalid Gemini thinking levels', async () => {
        process.env.GEMINI_THINKING_LEVEL = 'turbo';
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        const { getGeminiModel } = await import('@/lib/ai/gemini-client');
        const modelParams = getGeminiModel(false);

        expect(modelParams?.config.thinkingConfig).toBeUndefined();
        expect(warnSpy).toHaveBeenCalledWith(
            '[diagnostic] gemini_invalid_thinking_level', {}
        );
    });
});

describe('gemini-client retry behavior', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.useFakeTimers();
        process.env.GOOGLE_AI_API_KEY = 'test-api-key';
        delete process.env.GEMINI_GOOGLE_SEARCH_GROUNDING;
        delete process.env.GEMINI_THINKING_LEVEL;
        generateContentMock.mockReset();
        GoogleGenAIMock.mockReset();
        GoogleGenAIMock.mockImplementation(function MockGoogleGenAI() {
            return {
                models: {
                    generateContent: generateContentMock,
                },
            };
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it.each([400, 429, 503])('preserves retries and safe status for %s without provider text', async status => {
        const sinks = ['log', 'warn', 'error'].map(level => vi.spyOn(console, level as 'log' | 'warn' | 'error').mockImplementation(() => undefined));
        generateContentMock.mockRejectedValue({ status, name: 'SellerSentinel', message: '987 Sentinel Street seller@example.test token-sentinel password-sentinel postgres://sentinel', code: 'token-sentinel', error: { message: 'password-sentinel' } });
        const { generateJSONWithMeta } = await import('@/lib/ai/gemini-client');
        const pending = generateJSONWithMeta('prompt', { responseJsonSchema: {} });
        await vi.runAllTimersAsync();
        expect(await pending).toMatchObject({ failure: 'provider_error', failureKind: status === 429 ? 'rate_limited' : 'api_error' });
        expect(generateContentMock).toHaveBeenCalledTimes(status === 400 ? 1 : 3);
        const logged = JSON.stringify(sinks.flatMap(sink => sink.mock.calls));
        for (const sentinel of ['Sentinel', 'seller@example.test', 'token-sentinel', 'password-sentinel', 'postgres://sentinel']) expect(logged).not.toContain(sentinel);
        expect(logged).toContain('gemini_api_failed');
        expect(logged).toContain(String(status));
        if (status !== 400) expect(logged).toContain('gemini_retry');
        sinks.forEach(sink => sink.mockRestore());
    });

    it('keeps malformed provider output out of parse diagnostics', async () => {
        const sink = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const privateText = '987 Sentinel Street SellerSentinel seller@example.test token-sentinel password-sentinel postgres://sentinel';
        generateContentMock.mockResolvedValue({ candidates: [{}], text: privateText });
        const { generateJSONWithMeta } = await import('@/lib/ai/gemini-client');
        expect(await generateJSONWithMeta('prompt', { responseJsonSchema: {} })).toMatchObject({ data: null, failure: 'parse_error' });
        expect(sink).toHaveBeenCalledWith('[diagnostic] gemini_parse_failed', { errorName: 'SyntaxError', errorFamily: 'unclassified' });
        expect(JSON.stringify(sink.mock.calls)).not.toContain(privateText);
        sink.mockRestore();
    });

    it('does not retry non-retryable 400 errors', async () => {
        generateContentMock.mockRejectedValue({ status: 400, message: 'Bad request' });

        const { generateContent } = await import('@/lib/ai/gemini-client');
        const promise = generateContent('hello');
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result).toBeNull();
        expect(generateContentMock).toHaveBeenCalledTimes(1);
    });

    it('retries rate-limited 429 errors', async () => {
        generateContentMock.mockRejectedValue({ status: 429, message: 'Too many requests' });

        const { generateContent } = await import('@/lib/ai/gemini-client');
        const promise = generateContent('hello');
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result).toBeNull();
        expect(generateContentMock).toHaveBeenCalledTimes(3);
    });

    it('retries transient 500 errors', async () => {
        generateContentMock.mockRejectedValue({ status: 500, message: 'Internal error' });

        const { generateContent } = await import('@/lib/ai/gemini-client');
        const promise = generateContent('hello');
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result).toBeNull();
        expect(generateContentMock).toHaveBeenCalledTimes(3);
    });

    it('retries and classifies a response without candidate text as a provider error', async () => {
        generateContentMock.mockResolvedValue({
            candidates: [],
            text: undefined,
        });
        const schema = {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
        };

        const { generateJSONWithMeta } = await import('@/lib/ai/gemini-client');
        const promise = generateJSONWithMeta<{ name: string }>('prompt', {
            responseJsonSchema: schema,
        });
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result).toMatchObject({
            data: null,
            failure: 'provider_error',
            groundingSourceUrls: [],
            usage: { promptTokens: null, outputTokens: null, thinkingTokens: null, toolPromptTokens: null, searchQueryCount: null, sourceCount: null },
            failureKind: 'empty_response',
        });
        expect(generateContentMock).toHaveBeenCalledTimes(3);
    });

    it('tells a rate limit apart from other API errors', async () => {
        const { generateJSONWithMeta } = await import('@/lib/ai/gemini-client');

        generateContentMock.mockRejectedValue({ status: 429, message: 'Too many requests' });
        const limited = generateJSONWithMeta<unknown>('prompt', { responseJsonSchema: {} });
        await vi.runAllTimersAsync();
        expect((await limited).failureKind).toBe('rate_limited');
    });

    it('reports a rejected request as an API error and an open circuit as such', async () => {
        const { generateJSONWithMeta } = await import('@/lib/ai/gemini-client');
        generateContentMock.mockRejectedValue({ status: 400, message: 'Bad request' });

        for (let call = 0; call < 3; call += 1) {
            const rejected = generateJSONWithMeta<unknown>('prompt', { responseJsonSchema: {} });
            await vi.runAllTimersAsync();
            expect((await rejected).failureKind).toBe('api_error');
        }

        // Three failures in a row open the circuit; the next call is not sent.
        const skipped = await generateJSONWithMeta<unknown>('prompt', { responseJsonSchema: {} });
        expect(skipped.failureKind).toBe('circuit_open');
        expect(generateContentMock).toHaveBeenCalledTimes(3);
    });
});

describe('gemini-client timeouts', () => {
    const schema = {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
    };
    const providerError = (failureKind: string) => ({
        data: null, failure: 'provider_error', groundingSourceUrls: [], usage: null, failureKind,
    });

    function failAfter(ms: number, error: unknown) {
        return () => new Promise((_resolve, reject) => {
            setTimeout(() => reject(error), ms);
        });
    }

    async function settledAfter<T>(promise: Promise<T>, ms: number): Promise<T | 'pending'> {
        await vi.advanceTimersByTimeAsync(ms);
        return Promise.race([promise, Promise.resolve('pending' as const)]);
    }

    beforeEach(() => {
        vi.resetModules();
        vi.useFakeTimers();
        process.env.GOOGLE_AI_API_KEY = 'test-api-key';
        delete process.env.GEMINI_GOOGLE_SEARCH_GROUNDING;
        delete process.env.GEMINI_THINKING_LEVEL;
        delete process.env.GEMINI_CALL_TIMEOUT_MS;
        generateContentMock.mockReset();
        GoogleGenAIMock.mockReset();
        GoogleGenAIMock.mockImplementation(function MockGoogleGenAI() {
            return {
                models: {
                    generateContent: generateContentMock,
                },
            };
        });
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        delete process.env.GEMINI_CALL_TIMEOUT_MS;
    });

    it('ends a hung call at the per-call timeout, aborts it and does not retry', async () => {
        generateContentMock.mockImplementation(() => new Promise(() => undefined));

        const { generateJSONWithMeta } = await import('@/lib/ai/gemini-client');
        const promise = generateJSONWithMeta<{ name: string }>('prompt', { responseJsonSchema: schema });

        expect(await settledAfter(promise, 9_999)).toBe('pending');
        expect(await settledAfter(promise, 1)).toMatchObject(providerError('timeout'));
        expect(generateContentMock).toHaveBeenCalledTimes(1);

        const signal = generateContentMock.mock.calls[0][0].config.abortSignal as AbortSignal;
        expect(signal.aborted).toBe(true);

        await vi.runAllTimersAsync();
        expect(generateContentMock).toHaveBeenCalledTimes(1);
    });

    it('reads the per-call timeout from GEMINI_CALL_TIMEOUT_MS', async () => {
        process.env.GEMINI_CALL_TIMEOUT_MS = '3000';
        generateContentMock.mockImplementation(() => new Promise(() => undefined));

        const { generateJSONWithMeta } = await import('@/lib/ai/gemini-client');
        const promise = generateJSONWithMeta<{ name: string }>('prompt', { responseJsonSchema: schema });

        expect(await settledAfter(promise, 3_000)).toMatchObject(providerError('timeout'));
    });

    it('cuts a call short when the caller deadline comes before the per-call timeout', async () => {
        generateContentMock.mockImplementation(() => new Promise(() => undefined));

        const { generateJSONWithMeta } = await import('@/lib/ai/gemini-client');
        const promise = generateJSONWithMeta<{ name: string }>('prompt', {
            responseJsonSchema: schema,
            deadlineAt: Date.now() + 4_000,
        });

        expect(await settledAfter(promise, 3_999)).toBe('pending');
        expect(await settledAfter(promise, 1)).toMatchObject(providerError('timeout'));
    });

    it('does not start a retry that the deadline leaves no room for', async () => {
        generateContentMock.mockImplementation(failAfter(4_000, { status: 500, message: 'Internal error' }));

        const { generateJSONWithMeta } = await import('@/lib/ai/gemini-client');
        const promise = generateJSONWithMeta<{ name: string }>('prompt', {
            responseJsonSchema: schema,
            deadlineAt: Date.now() + 5_000,
        });

        expect(await settledAfter(promise, 5_000)).toMatchObject(providerError('api_error'));
        expect(generateContentMock).toHaveBeenCalledTimes(1);
    });

    it('bounds slow retries without a caller deadline to twice the per-call timeout', async () => {
        generateContentMock.mockImplementation(failAfter(9_000, { status: 500, message: 'Internal error' }));

        const { generateJSONWithMeta } = await import('@/lib/ai/gemini-client');
        const promise = generateJSONWithMeta<{ name: string }>('prompt', { responseJsonSchema: schema });

        expect(await settledAfter(promise, 20_000)).toMatchObject(providerError('api_error'));
        expect(generateContentMock).toHaveBeenCalledTimes(2);
    });

    it('does not call the model when the deadline has already passed', async () => {
        const { generateJSONWithMeta } = await import('@/lib/ai/gemini-client');
        const result = await generateJSONWithMeta<{ name: string }>('prompt', {
            responseJsonSchema: schema,
            deadlineAt: Date.now() - 1,
        });

        expect(result).toMatchObject(providerError('deadline'));
        expect(generateContentMock).not.toHaveBeenCalled();
    });
});
