// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { transportCoverage } from '@/lib/telemetry/ai-lineage';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
const answered = (text: string, withGrounding = true) => ({ candidates: [{ content: { role: 'model',parts: [{ text }] },
    ...(withGrounding ? { groundingMetadata: { webSearchQueries: [],groundingChunks: [] } } : {}) }],
    usageMetadata: { promptTokenCount: 30,candidatesTokenCount: 10,thoughtsTokenCount: 0,toolUsePromptTokenCount: 0 } });
async function client() {
    vi.resetModules(); vi.stubEnv('GOOGLE_AI_API_KEY','synthetic-driver-key'); vi.stubEnv('GEMINI_GOOGLE_SEARCH_GROUNDING','true');
    vi.spyOn(console,'warn').mockImplementation(() => undefined); vi.spyOn(console,'error').mockImplementation(() => undefined);
    return import('@/lib/ai/gemini-client');
}
describe('installed Gemini SDK and bounded lineage', () => {
    it('counts actual SDK invocations and recovered failures, with partial usage despite an answered retry', async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 503,message: 'private-error-sentinel' } }),{ status: 503 }))
            .mockResolvedValueOnce(new Response(JSON.stringify(answered('{"ok":true}')),{ status: 200 }));
        vi.stubGlobal('fetch',fetchMock);
        const { generateJSONWithMeta } = await client();
        const result = await generateJSONWithMeta<{ ok: boolean }>('private-prompt-sentinel',{ responseJsonSchema: { type: 'object' },passRole: 'search' });
        expect(result.data).toEqual({ ok: true }); expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result.transport?.attempts).toHaveLength(2);
        expect(result.failureKind).toBe('api_error');
        expect(transportCoverage(result.transport!).promptTokens).toEqual({ started: 2,reported: 1,sum: 30,coverage: 'partial' });
        expect(result.usage?.searchQueryCount).toBeNull();
        for (const sentinel of ['private-prompt-sentinel','private-error-sentinel','synthetic-driver-key']) expect(JSON.stringify(result.transport)).not.toContain(sentinel);
    });
    it('retains numeric usage before retrying empty text, and counts parse failure as an answered attempt', async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(answered('')),{ status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify(answered('invalid-json')),{ status: 200 }));
        vi.stubGlobal('fetch',fetchMock);
        const { generateJSONWithMeta } = await client();
        const result = await generateJSONWithMeta('fixture',{ responseJsonSchema: { type: 'object' } });
        expect(result.failure).toBe('parse_error'); expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result.usage?.promptTokens).toBe(60);
        expect(result.transport?.attempts.map(a => [a.outcome,a.failure])).toEqual([['answered','empty_response'],['answered',null]]);
        expect(transportCoverage(result.transport!).promptTokens.coverage).toBe('complete');
    });
    it('keeps omitted grounding unknown and explicit empty arrays as reported zero', async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(answered('[]',false)),{ status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify(answered('[]',true)),{ status: 200 }));
        vi.stubGlobal('fetch',fetchMock);
        const { generateJSONWithMeta } = await client();
        const missing = await generateJSONWithMeta('fixture',{ responseJsonSchema: { type: 'array' } });
        const zero = await generateJSONWithMeta('fixture',{ responseJsonSchema: { type: 'array' } });
        expect(transportCoverage(missing.transport!).searchQueryCount.coverage).toBe('none');
        expect(transportCoverage(zero.transport!).searchQueryCount).toEqual({ started: 1,reported: 1,sum: 0,coverage: 'complete' });
        expect(missing.transport?.attempts[0]).toMatchObject({ candidates: 1,queryCandidates: 0,sourceCandidates: 0 });
    });
    it('records zero started attempts for an expired caller deadline', async () => {
        const fetchMock = vi.fn(); vi.stubGlobal('fetch',fetchMock);
        const { generateJSONWithMeta } = await client();
        const result = await generateJSONWithMeta('fixture',{ responseJsonSchema: { type: 'object' },deadlineAt: Date.now()-1 });
        expect(fetchMock).not.toHaveBeenCalled(); expect(result.transport).toMatchObject({ skipped: 'deadline',attempts: [] });
    });
});

it('cannot mutate finalized attempt coverage when an ignored abort completes late', async () => {
    vi.useFakeTimers();vi.stubEnv('GEMINI_CALL_TIMEOUT_MS','1000');
    let release!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>(resolve => { release=resolve; }));
    vi.stubGlobal('fetch',fetchMock);
    try {
        const { generateJSONWithMeta } = await client();
        const pending = generateJSONWithMeta('fixture',{ responseJsonSchema: { type: 'object' } });
        await vi.advanceTimersByTimeAsync(1000);
        const result = await pending;const finalized = JSON.stringify(result.transport);
        expect(result.failureKind).toBe('timeout');expect(result.transport?.attempts).toHaveLength(1);
        release(new Response(JSON.stringify(answered('{}')),{ status: 200 }));await vi.advanceTimersByTimeAsync(1);
        expect(JSON.stringify(result.transport)).toBe(finalized);expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
});
