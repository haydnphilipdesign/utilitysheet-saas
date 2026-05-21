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
    });

    afterEach(() => {
        vi.useRealTimers();
        process.env = { ...originalEnv };
    });

    it('enables Google Search grounding by default for JSON generation', async () => {
        const { getGeminiModel } = await import('@/lib/ai/gemini-client');
        const modelParams = getGeminiModel(true);

        expect(GoogleGenAIMock).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
        expect(modelParams?.model).toBe('gemini-3.5-flash');
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
        expect(modelParams?.model).toBe('gemini-3.5-flash');
    });

    it('allows overriding the Gemini model via GEMINI_MODEL_NAME', async () => {
        process.env.GEMINI_MODEL_NAME = 'gemini-3-flash-preview';

        const { getGeminiModel } = await import('@/lib/ai/gemini-client');
        const modelParams = getGeminiModel(false);

        expect(modelParams?.model).toBe('gemini-3-flash-preview');
    });
});

describe('gemini-client retry behavior', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.useFakeTimers();
        process.env.GOOGLE_AI_API_KEY = 'test-api-key';
        delete process.env.GEMINI_GOOGLE_SEARCH_GROUNDING;
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
});
