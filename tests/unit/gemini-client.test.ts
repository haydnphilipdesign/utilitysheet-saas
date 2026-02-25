import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getGenerativeModelMock = vi.hoisted(() => vi.fn());
const GoogleGenerativeAIMock = vi.hoisted(() => vi.fn(function MockGoogleGenerativeAI() {
    return {
        getGenerativeModel: getGenerativeModelMock,
    };
}));

vi.mock('@google/generative-ai', () => ({
    DynamicRetrievalMode: {
        MODE_DYNAMIC: 'MODE_DYNAMIC',
    },
    GoogleGenerativeAI: GoogleGenerativeAIMock,
}));

describe('gemini-client grounding config', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        vi.resetModules();
        getGenerativeModelMock.mockReset();
        GoogleGenerativeAIMock.mockReset();
        GoogleGenerativeAIMock.mockImplementation(function MockGoogleGenerativeAI() {
            return {
                getGenerativeModel: getGenerativeModelMock,
            };
        });

        process.env.GOOGLE_AI_API_KEY = 'test-api-key';
        delete process.env.GEMINI_GOOGLE_SEARCH_GROUNDING;
        delete process.env.GEMINI_GROUNDING_DYNAMIC_THRESHOLD;
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it('enables Google Search grounding by default for JSON generation', async () => {
        const { getGeminiModel } = await import('@/lib/ai/gemini-client');
        getGeminiModel(true);

        expect(GoogleGenerativeAIMock).toHaveBeenCalledWith('test-api-key');
        expect(getGenerativeModelMock).toHaveBeenCalledTimes(1);

        const modelParams = getGenerativeModelMock.mock.calls[0]?.[0] as {
            generationConfig?: { responseMimeType?: string };
            tools?: Array<{ googleSearchRetrieval?: { dynamicRetrievalConfig?: { mode?: string; dynamicThreshold?: number } } }>;
        };

        expect(modelParams.generationConfig?.responseMimeType).toBe('application/json');
        expect(modelParams.tools).toEqual([
            {
                googleSearchRetrieval: {
                    dynamicRetrievalConfig: {
                        mode: 'MODE_DYNAMIC',
                        dynamicThreshold: 0,
                    },
                },
            },
        ]);
    });

    it('allows explicitly disabling grounding', async () => {
        process.env.GEMINI_GOOGLE_SEARCH_GROUNDING = 'false';

        const { getGeminiModel } = await import('@/lib/ai/gemini-client');
        getGeminiModel(false);

        const modelParams = getGenerativeModelMock.mock.calls[0]?.[0] as {
            tools?: unknown[];
        };
        expect(modelParams.tools).toBeUndefined();
    });

    it('uses configured grounding threshold when provided', async () => {
        process.env.GEMINI_GROUNDING_DYNAMIC_THRESHOLD = '0.42';

        const { getGeminiModel } = await import('@/lib/ai/gemini-client');
        getGeminiModel(false);

        const modelParams = getGenerativeModelMock.mock.calls[0]?.[0] as {
            tools?: Array<{ googleSearchRetrieval?: { dynamicRetrievalConfig?: { dynamicThreshold?: number } } }>;
        };
        expect(modelParams.tools?.[0]?.googleSearchRetrieval?.dynamicRetrievalConfig?.dynamicThreshold).toBe(0.42);
    });
});
