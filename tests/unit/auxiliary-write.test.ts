// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { neonConfig } from '@neondatabase/serverless';

// Exercise the installed driver, with a synthetic connection and intercepted HTTP.
vi.mock('@/lib/neon/db', async () => {
    const { neon } = await import('@neondatabase/serverless');
    return { sql: neon('postgresql://fixture:fixture@telemetry.invalid/fixture') };
});

import { createEventLog } from '@/lib/neon/queries/event-logs';
import { createAiSuggestionRun, markAiSuggestionSelection, type CreateAiSuggestionRunInput } from '@/lib/neon/queries/ai-telemetry';
import { recordOperationalEvent, recordOperationalSuccess, startJobRun, finishJobRun } from '@/lib/ops/events';
import { auxiliaryEventWriter } from '@/lib/telemetry/auxiliary-events';
import { AUXILIARY_WRITE_BUDGET_MS, writeAuxiliary } from '@/lib/telemetry/auxiliary-write';

const PRIVATE = '987 Sentinel Street seller@example.test capability-sentinel password-sentinel postgres://private';
const fetchMock = vi.fn<typeof fetch>();
const oldFetch = neonConfig.fetchFunction;
const recordEvent = auxiliaryEventWriter(createEventLog);
const run: CreateAiSuggestionRunInput = {
    feature: 'provider_suggestions', category: 'electric', provider: 'gemini', model: 'fixture',
    promptVersion: 'fixture', servedPipeline: 'new', source: 'ai_primary', status: 'success',
    reasonCode: null, upstreamReasonCode: null, latencyMs: 1, attemptCount: 1,
    localityState: null, localityZip3: null, localityCity: null,
    suggestionCount: 1, suggestions: [{ display_name: 'Fixture Electric', confidence: 0.9 }],
};
const response = (id?: string) => new Response(JSON.stringify({
    fields: id ? [{ name: 'id', dataTypeID: 25 }] : [], rows: id ? [[id]] : [],
}), { status: 200 });
const signalAt = (index = 0) => fetchMock.mock.calls[index][1]!.signal as AbortSignal;

beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    fetchMock.mockReset().mockResolvedValue(response());
    neonConfig.fetchFunction = fetchMock;
});
afterEach(() => {
    neonConfig.fetchFunction = oldFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
});

async function expire<T>(pending: Promise<T>): Promise<T> {
    await vi.advanceTimersByTimeAsync(AUXILIARY_WRITE_BUDGET_MS);
    return pending;
}
function abortingFetch() {
    fetchMock.mockImplementationOnce(async (_url, options) => new Promise<Response>((_, reject) => {
        options!.signal!.addEventListener('abort', () => reject(new Error(PRIVATE)), { once: true });
    }));
}
function expectOneSafeMarker(observation: string, reason: string) {
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith('[diagnostic] auxiliary_write_failed', expect.objectContaining({ observation, reason }));
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(PRIVATE);
}

describe('bounded auxiliary persistence through installed Neon', () => {
    it('awaits an event and clears its deadline on success', async () => {
        await recordEvent({ requestId: 'fixture', eventType: 'request_created', eventData: { actor: 'agent' } });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(signalAt().aborted).toBe(false);
        expect(JSON.parse(String(fetchMock.mock.calls[0][1]!.body)).params).toEqual(['fixture', 'request_created', '{"actor":"agent"}', null, null]);
        expect(vi.getTimerCount()).toBe(0);
        expect(console.warn).not.toHaveBeenCalled();
    });

    it('actively aborts event HTTP and returns at the deadline without retry', async () => {
        abortingFetch();
        await expire(recordEvent({ requestId: 'fixture', eventType: 'seller_opened' }));
        expect(signalAt().aborted).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expectOneSafeMarker('seller_opened', 'deadline');
    });

    it('keeps the strict event writer rejecting for required callers', async () => {
        fetchMock.mockRejectedValueOnce(new Error(PRIVATE));
        await expect(createEventLog({ requestId: 'fixture', eventType: 'required_evidence' })).rejects.toThrow();
        expect(fetchMock.mock.calls[0][1]!.signal).toBeUndefined();
        expect(console.warn).not.toHaveBeenCalled();
    });

    it('handles a sink that ignores abort and a late rejection with one marker', async () => {
        let rejectLate!: (error: Error) => void;
        fetchMock.mockImplementationOnce(() => new Promise<Response>((_, reject) => { rejectLate = reject; }));
        await expire(recordEvent({ requestId: 'fixture', eventType: 'seller_self_send_link' }));
        expect(signalAt().aborted).toBe(true);
        rejectLate(new Error(PRIVATE));
        await vi.advanceTimersByTimeAsync(1);
        expectOneSafeMarker('seller_self_send_link', 'deadline');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('shares one AI deadline across run and item queries', async () => {
        fetchMock.mockImplementationOnce(async () => {
            await new Promise(resolve => setTimeout(resolve, 300));
            return response('00000000-0000-4000-8000-000000000001');
        });
        fetchMock.mockImplementationOnce(async (_url, options) => new Promise<Response>((_, reject) => {
            options!.signal!.addEventListener('abort', () => reject(new Error(PRIVATE)), { once: true });
        }));
        expect(await expire(createAiSuggestionRun(run))).toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(signalAt(0)).toBe(signalAt(1));
        expect(signalAt(1).aborted).toBe(true);
        expectOneSafeMarker('ai_run', 'deadline');
    });

    it('does not start item persistence after a late run result', async () => {
        let resolveLate!: (response: Response) => void;
        fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { resolveLate = resolve; }));
        expect(await expire(createAiSuggestionRun(run))).toBeNull();
        resolveLate(response('00000000-0000-4000-8000-000000000001'));
        await vi.advanceTimersByTimeAsync(1);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expectOneSafeMarker('ai_run', 'deadline');
    });

    it('keeps selection failures auxiliary without retry', async () => {
        fetchMock.mockRejectedValueOnce(Object.assign(new Error(PRIVATE), { code: PRIVATE, name: PRIVATE }));
        await markAiSuggestionSelection({ requestId: 'fixture', category: 'electric', selectedName: 'Fixture Electric', finalEntryMode: 'suggested_confirmed' });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expectOneSafeMarker('ai_selection', 'write_failed');
    });

    it.each(['failure', 'success', 'start', 'finish'] as const)('aborts the %s operational writer at its actual fetch boundary', async (kind) => {
        abortingFetch();
        const input = { category: 'pdf' as const, code: 'fixture' };
        const pending = kind === 'failure' ? recordOperationalEvent({ ...input, outcome: 'failure' })
            : kind === 'success' ? recordOperationalSuccess(input)
            : kind === 'start' ? startJobRun('ops_monitor')
            : finishJobRun({ id: '00000000-0000-4000-8000-000000000001', jobName: 'ops_monitor', startedAtMs: Date.now() }, 'success');
        const result = await expire<unknown>(pending);
        expect(result).toEqual(kind === 'start' ? { id: null, jobName: 'ops_monitor', startedAtMs: expect.any(Number) }
            : kind === 'finish' ? undefined : false);
        expect(signalAt().aborted).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expectOneSafeMarker(kind === 'start' ? 'job_start' : kind === 'finish' ? 'job_finish' : `operational_${kind === 'failure' ? 'event' : 'success'}`, 'deadline');
    });

    it('does not change a timed-out job handle when a sink later returns an id', async () => {
        let resolveLate!: (response: Response) => void;
        fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { resolveLate = resolve; }));
        const handle = await expire(startJobRun('ops_monitor'));
        resolveLate(response('00000000-0000-4000-8000-000000000001'));
        await vi.advanceTimersByTimeAsync(1);
        expect(handle.id).toBeNull();
        await finishJobRun(handle, 'success');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('isolates a synchronous writer throw and an unavailable console sink', async () => {
        vi.mocked(console.warn).mockImplementation(() => { throw new Error(PRIVATE); });
        expect(await writeAuxiliary('ai_run', () => { throw new Error(PRIVATE); }, null)).toBeNull();
        expect(vi.getTimerCount()).toBe(0);
    });
});
