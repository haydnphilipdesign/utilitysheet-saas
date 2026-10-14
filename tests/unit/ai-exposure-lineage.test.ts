// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { createSchemaDatabase, pgliteExecutor } from '../helpers/pglite-db';

const mocks = vi.hoisted(() => ({ query: vi.fn(), generate: vi.fn(), configured: vi.fn(), memory: vi.fn(), cache: new Map<string,unknown>() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/neon/db', () => ({ sql: { query: mocks.query } }));
vi.mock('@/lib/neon/queries/provider-memory', () => ({ getProviderMemoryCandidates: mocks.memory }));
vi.mock('@/lib/ai/gemini-client', () => ({ generateJSONWithMeta: mocks.generate, isGeminiConfigured: mocks.configured,
    getGeminiModelName: () => 'fixture-model', getGeminiThinkingLevelName: () => 'low' }));
vi.mock('@/lib/cache', () => ({ getFromCache: async (key: string) => mocks.cache.get(key) ?? null,
    setInCache: async (key: string,value: unknown) => { mocks.cache.set(key,value); return true; } }));

import { getSuggestionsResult, searchProvidersResult } from '@/lib/providers/suggestion-service';
import { resolveContact } from '@/lib/providers/contact-service';
import { recordAcceptedChoices, recordContactSkips, exposeGeneration, type GenerationHandle } from '@/lib/neon/queries/ai-lineage';
import { persistAiGeneration, type CreateAiSuggestionRunInput } from '@/lib/neon/queries/ai-telemetry';
import { insertSellerObservations } from '@/lib/neon/queries/seller-observations';
import { readAiLineageReport } from '@/lib/neon/queries/ai-lineage-report';
import { runRetention, resolveRetentionPlan } from '@/lib/telemetry/retention';
import { emptyTransport, mergeTransport, transportCoverage, optionalItemLineageSchema, type OriginMetadata } from '@/lib/telemetry/ai-lineage';

let db: PGlite;
const ACCOUNT = randomUUID(), ACCOUNT2 = randomUUID(), ONE = randomUUID(), TWO = randomUUID(), THREE = randomUUID();
const address = '12 Fixture Street, Philadelphia, PA 19103';
const usage = { promptTokens: 100, outputTokens: 20, thinkingTokens: 0, toolPromptTokens: 0, searchQueryCount: 1, sourceCount: 1 };
const origin: OriginMetadata = { v: 1, lineageVersion: 2, source: 'ai_primary', status: 'success', reason: null, upstreamReason: null,
    listKind: 'ai', model: 'fixture-model', promptVersion: 'fixture', requestFormat: 'fixture', thinkingLevel: 'low', producedAt: new Date().toISOString() };
const query = <T = Record<string,unknown>>(text: string, params: unknown[] = []) => db.query<T>(text,params).then(r => r.rows);
const context = (requestId = ONE, accountId = ACCOUNT) => ({ requestId,accountId,organizationId: null,editVersion: 0,mode: 'live' as const });
const signal = () => new AbortController().signal;
function input(items = [{ display_name: 'Fixture Electric', confidence: 0.9 }]): CreateAiSuggestionRunInput {
    return { id: randomUUID(),itemIds: items.map(() => randomUUID()),lineageVersion: 2,transport: emptyTransport(),
        requestId: ONE,accountId: ACCOUNT,feature: 'provider_suggestions',category: 'electric',provider: 'gemini',model: 'fixture-model',
        promptVersion: 'fixture',servedPipeline: 'new',source: 'ai_primary',status: 'success',reasonCode: null,upstreamReasonCode: null,
        latencyMs: 1,attemptCount: 0,localityState: 'PA',localityZip3: '191',localityCity: 'Philadelphia',suggestionCount: items.length,suggestions: items };
}
function ack(requestId: string, exposureId: string, itemIds: string[], editVersion = 0) {
    const eventId = randomUUID();
    return insertSellerObservations({ requestId,rows: [{ eventType: 'seller_suggestions_rendered',eventId,
        eventData: { v: 2,actor: 'seller_browser',event_id: eventId,session_id: randomUUID(),edit_version: editVersion,
            category: 'electric',source: 'initial',result_count: itemIds.length,exposure_id: exposureId,rendered_item_ids: itemIds } }] });
}

beforeAll(async () => {
    db = await createSchemaDatabase();
    await db.exec(readFileSync('migrations-ai-exposure-lineage.sql','utf8')); // Idempotent forward path, disposable DB only.
},60000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
    vi.clearAllMocks(); mocks.cache.clear();
    vi.spyOn(console,'warn').mockImplementation(() => undefined);
    mocks.query.mockImplementation(async (text: string,params: unknown[]) => query(text,params));
    mocks.configured.mockReturnValue(true); mocks.memory.mockResolvedValue([]);
    delete process.env.ALLOW_UNVERIFIED_AI_CONTACTS;
    mocks.generate.mockResolvedValue({ data: [{ display_name: 'Fixture Electric',confidence: 0.9 }],failure: null,usage,failureKind: null,
        groundingSourceUrls: [],transport: { ...emptyTransport(null,true),attempts: [{ pass: 0,role: 'primary',index: 1,elapsedMs: 10,
            outcome: 'answered',failure: null,usage,candidates: 1,queryCandidates: 1,sourceCandidates: 1 }] } });
    await db.exec('TRUNCATE accounts,requests,ai_generation_runs,event_logs CASCADE');
    await db.query('INSERT INTO accounts (id,email) VALUES ($1,$2),($3,$4)',[ACCOUNT,'fixture@example.test',ACCOUNT2,'other@example.test']);
    for (const [requestId,accountId] of [[ONE,ACCOUNT],[TWO,ACCOUNT],[THREE,ACCOUNT2]]) await db.query(
        "INSERT INTO requests (id,account_id,property_address,status,public_token,seller_token) VALUES ($1,$2,$3,'in_progress',$4,$5)",
        [requestId,accountId,address,randomUUID(),randomUUID()]);
});

describe('real generation/exposure/choice persistence', () => {
    it('generates once for two consumers, preserves cache origin and isolates account scope', async () => {
        const [a,b] = await Promise.all([getSuggestionsResult(address,'electric',context()),getSuggestionsResult(address,'electric',context(TWO))]);
        expect(mocks.generate).toHaveBeenCalledTimes(1);
        expect(a.results[0].ai_lineage).toBeDefined(); expect(b.results[0].ai_lineage).toBeDefined();
        expect(a.results[0].ai_lineage!.run_id).toBe(b.results[0].ai_lineage!.run_id);
        expect(a.exposure!.exposure_id).not.toBe(b.exposure!.exposure_id);
        expect(await query('SELECT COUNT(*)::int AS n FROM ai_generation_runs')).toEqual([{ n: 1 }]);
        expect((await query('SELECT delivery_kind FROM ai_result_exposures ORDER BY delivery_kind')).map(r => r.delivery_kind)).toEqual(['fresh','shared']);
        const cached = await getSuggestionsResult(address,'electric',context(TWO));
        expect(cached.results[0].ai_lineage!.run_id).toBe(a.results[0].ai_lineage!.run_id);
        expect(mocks.generate).toHaveBeenCalledTimes(1);
        expect(await query('SELECT SUM(prompt_tokens)::int AS n FROM ai_generation_runs')).toEqual([{ n: 100 }]);
        const envelopes = JSON.stringify([...mocks.cache.values()]);
        for (const value of [ONE,TWO,a.exposure!.exposure_id,address]) expect(envelopes).not.toContain(value);
        expect(envelopes).toContain('ai_primary'); expect(envelopes).not.toContain('ai_lineage');
        await getSuggestionsResult(address,'electric',context(THREE,ACCOUNT2));
        expect(mocks.generate).toHaveBeenCalledTimes(2);
    });

    it('rolls back the entire run on item failure and atomically records zero-item output', async () => {
        const existing = input(); await persistAiGeneration(existing,signal());
        const broken = input(); broken.itemIds = existing.itemIds;
        await expect(persistAiGeneration(broken,signal(),{ id: randomUUID(),context: { ...context(),feature: 'provider_suggestions',category: 'electric' },origin,durationMs: 1 })).rejects.toThrow();
        expect(await query('SELECT COUNT(*)::int AS n FROM ai_generation_runs')).toEqual([{ n: 1 }]);
        expect(await query('SELECT COUNT(*)::int AS n FROM ai_result_exposures')).toEqual([{ n: 0 }]);
        const empty = input([]);
        const result = await persistAiGeneration(empty,signal(),{ id: randomUUID(),context: { ...context(),feature: 'provider_suggestions',category: 'electric' },origin: { ...origin,listKind: 'no_list' },durationMs: 1 });
        expect(result.exposureId).toBeTruthy();
        expect(await query('SELECT served_item_ids FROM ai_result_exposures')).toEqual([{ served_item_ids: [] }]);
    });

    it('accepts an exact choice without an ack, rejects foreign/mismatched references, never mutates legacy selection and is immutable across reopen', async () => {
        const a = await getSuggestionsResult(address,'electric',context());
        const lineage = a.results[0].ai_lineage!;
        await db.exec("UPDATE requests SET status='submitted'");
        await recordAcceptedChoices(ONE,0,[{ category: 'electric',entryMode: 'suggested_confirmed',selectedName: 'Fixture Electric',lineage }]);
        await recordAcceptedChoices(ONE,0,[{ category: 'electric',entryMode: 'unknown',selectedName: null }]);
        await recordAcceptedChoices(TWO,0,[{ category: 'electric',entryMode: 'suggested_confirmed',selectedName: 'Fixture Electric',lineage }]);
        await recordAcceptedChoices(THREE,0,[{ category: 'electric',entryMode: 'suggested_confirmed',selectedName: 'Different',lineage }]);
        const choices = await query('SELECT request_id,linkage_outcome FROM ai_selection_observations');
        expect(choices.find(r => r.request_id===ONE)?.linkage_outcome).toBe('linked');
        expect(choices.filter(r => r.linkage_outcome==='invalid')).toHaveLength(2);
        expect(await query('SELECT selected_by_seller FROM ai_suggestion_items')).toEqual([{ selected_by_seller: null }]);
        await db.query('UPDATE requests SET seller_edit_version=1 WHERE id=$1',[ONE]);
        await recordAcceptedChoices(ONE,1,[{ category: 'electric',entryMode: 'suggested_confirmed',selectedName: 'Fixture Electric',lineage }]);
        expect(await query('SELECT edit_version,linkage_outcome FROM ai_selection_observations WHERE request_id=$1 ORDER BY edit_version',[ONE]))
            .toEqual([{ edit_version: 0,linkage_outcome: 'linked' },{ edit_version: 1,linkage_outcome: 'stale' }]);
        expect(optionalItemLineageSchema.parse({ exposure_id: 'malformed',run_id: 'private',item_id: 'private' })).toBeUndefined();
    });

    it('strips invalid advisory lineage and counts distinct retained item/exposure memberships', async () => {
        const a = await getSuggestionsResult(address,'electric',context());
        const l = a.results[0].ai_lineage!;
        await ack(ONE,l.exposure_id,[l.item_id]); await ack(ONE,l.exposure_id,[l.item_id]);
        await ack(TWO,l.exposure_id,[l.item_id]); await ack(ONE,l.exposure_id,[randomUUID()]);
        const events = await query<{ request_id: string;event_data: Record<string,unknown> }>('SELECT request_id,event_data FROM event_logs ORDER BY created_at');
        expect(events.slice(2).every(e => e.event_data.exposure_id===undefined && e.event_data.result_count===1)).toBe(true);
        await db.query("UPDATE requests SET status='submitted' WHERE id=$1",[ONE]);
        await recordAcceptedChoices(ONE,0,[{ category: 'electric',entryMode: 'suggested_confirmed',selectedName: 'Fixture Electric',lineage: l }]);
        const report = await readAiLineageReport(30);
        expect(report.state).toBe('available');
        expect(report.cohorts[0]).toMatchObject({ exposures: 1,origins: 1,reportedExposures: 1,reportedItems: 1,linkedWithAck: 1 });
        expect(JSON.stringify(report)).not.toContain('Fixture Electric');
        expect(JSON.stringify(report)).not.toContain(l.item_id);
        expect(report.generations[0]).toMatchObject({ count: 1,attempts: 1,incomplete: 0 });
        await db.query("INSERT INTO utility_entries (request_id,category,entry_mode,display_name) VALUES ($1,'electric','free_text','Corrected Fixture')",[ONE]);
        await db.query("INSERT INTO event_logs (request_id,event_type) VALUES ($1,'submitted_sheet_edited')",[ONE]);
        expect((await readAiLineageReport(30)).cohorts[0]).toMatchObject({ currentChoiceDiffers: 1,laterEdits: 1,linkedChoices: 1 });
    });

    it('retains fallback/no-list origin, negative contact cache and disabled coverage without copying contact fields', async () => {
        mocks.configured.mockReturnValue(false);
        const common = await getSuggestionsResult(address,'internet',context());
        const empty = await getSuggestionsResult(address,'electric',context());
        expect(common.results.length).toBeGreaterThan(0); expect(empty.results).toEqual([]); expect(empty.exposure).toBeDefined();
        await getSuggestionsResult(address,'internet',context(TWO));
        await resolveContact('Private Contact Sentinel', { ...context(),category: 'water',address });
        await resolveContact('Private Contact Sentinel', { ...context(TWO),category: 'water',address });
        process.env.ALLOW_UNVERIFIED_AI_CONTACTS='false';
        await resolveContact('Private Contact Sentinel', { ...context(),category: 'water',address });
        await recordContactSkips(ONE,0,[{ category: 'gas',reason: 'submitted_contact' },{ category: 'sewer',reason: 'historical_contact' }]);
        expect(mocks.generate).not.toHaveBeenCalled();
        const exposures = await query('SELECT lookup_state,origin_metadata,delivery_kind FROM ai_result_exposures');
        expect(exposures.some(e => e.lookup_state==='disabled')).toBe(true);
        expect(exposures.some(e => e.lookup_state==='submitted_contact')).toBe(true);
        expect(exposures.some(e => e.lookup_state==='historical_contact')).toBe(true);
        expect(exposures.filter(e => e.delivery_kind==='cache')).toHaveLength(2);
        expect(JSON.stringify(exposures)).not.toContain('Private Contact Sentinel');
        expect(JSON.stringify(exposures)).toContain('no_list'); expect(JSON.stringify(exposures)).toContain('common');
    });

    it('preserves younger evidence when an origin expires, cascades request deletion, and isolates missing-schema readers', async () => {
        const a = await getSuggestionsResult(address,'electric',context()); const l = a.results[0].ai_lineage!;
        await db.query("UPDATE requests SET status='submitted' WHERE id=$1",[ONE]);
        await recordAcceptedChoices(ONE,0,[{ category: 'electric',entryMode: 'suggested_confirmed',selectedName: 'Fixture Electric',lineage: l }]);
        await ack(ONE,l.exposure_id,[l.item_id]);
        await db.query("UPDATE ai_generation_runs SET created_at=NOW()-INTERVAL '366 days' WHERE id=$1",[l.run_id]);
        const preview = await runRetention({ db: pgliteExecutor(db),items: resolveRetentionPlan({ TELEMETRY_RETENTION_MODE: 'preview' }).items });
        expect(preview.find(r => r.key==='aiRuns')?.affected).toBe(1);
        await runRetention({ db: pgliteExecutor(db),items: resolveRetentionPlan({ TELEMETRY_RETENTION_MODE: 'enforce' }).items });
        expect(await query('SELECT run_id FROM ai_result_exposures')).toEqual([{ run_id: null }]);
        expect((await readAiLineageReport(30)).choices).toEqual([{ cohort: 'first',outcome: 'origin_unavailable',count: 1 }]);
        const cached = await getSuggestionsResult(address,'electric',context(TWO));
        expect(cached.results[0].ai_lineage).toBeUndefined(); expect(cached.exposure?.run_id).toBeNull();
        await db.query('DELETE FROM requests WHERE id=$1',[ONE]);
        expect(await query('SELECT COUNT(*)::int AS n FROM ai_selection_observations')).toEqual([{ n: 0 }]);
        mocks.query.mockRejectedValueOnce(Object.assign(new Error('private sql sentinel'),{ code: '42P01' }));
        expect((await readAiLineageReport(30)).state).toBe('not_installed');
        mocks.query.mockRejectedValueOnce(new Error('private sql sentinel'));
        expect((await readAiLineageReport(30)).state).toBe('unavailable');
    });

    it('keeps results usable on missing/slow telemetry, does not recreate an unavailable origin or start a late follower query', async () => {
        mocks.query.mockRejectedValueOnce(new Error('private sentinel'));
        const lost = await searchProvidersResult('fixture','electric',address,context());
        expect(lost.results[0].display_name).toBe('Fixture Electric'); expect(lost.results[0].ai_lineage).toBeUndefined();
        expect(mocks.generate).toHaveBeenCalledTimes(1);
        const handle: GenerationHandle = { input: input(),origin,runId: null,itemIds: [] };
        let release!: (value: { runId: string|null;exposureId: string|null }) => void;
        handle.persistence = new Promise(resolve => { release=resolve; });
        vi.useFakeTimers();
        const before = mocks.query.mock.calls.length;
        const pending = exposeGeneration(handle,{ ...context(),feature: 'provider_search',category: 'electric' },'shared',Date.now());
        await vi.advanceTimersByTimeAsync(500); expect(await pending).toBeUndefined();
        release({ runId: randomUUID(),exposureId: randomUUID() }); await vi.advanceTimersByTimeAsync(1);
        expect(mocks.query.mock.calls.length).toBe(before); vi.useRealTimers();
    });
});

it('marks available transport sums as lower bounds when a recovered failure omitted usage', () => {
    const summary = { ...emptyTransport(null,true),attempts: [
        { pass: 0 as const,role: 'search' as const,index: 1,elapsedMs: 1,outcome: 'failed' as const,failure: 'rate_limited' as const,usage: null,candidates: null,queryCandidates: null,sourceCandidates: null },
        { pass: 0 as const,role: 'search' as const,index: 2,elapsedMs: 1,outcome: 'answered' as const,failure: null,usage,candidates: 1,queryCandidates: 1,sourceCandidates: 1 },
    ] };
    expect(transportCoverage(summary).promptTokens).toEqual({ started: 2,reported: 1,sum: 100,coverage: 'partial' });
    expect(transportCoverage({ ...summary,truncated: true }).searchQueryCount.coverage).toBe('partial');
});

it('migrates the previous schema forward twice without reclassifying historical rows, and uses the scoped index', async () => {
    const old = new PGlite({ extensions: { uuid_ossp } });
    try {
        const base = readFileSync('schema.sql','utf8').split('-- Slice 8 additive migration.')[0];
        await old.exec(base);
        const legacyId = randomUUID();
        await old.query("INSERT INTO ai_generation_runs (id,feature,prompt_version,status,source,prompt_tokens) VALUES ($1,'provider_suggestions','legacy','success','cache',17)",[legacyId]);
        await old.exec(readFileSync('migrations-ai-exposure-lineage.sql','utf8'));
        await old.exec(readFileSync('migrations-ai-exposure-lineage.sql','utf8'));
        expect((await old.query('SELECT lineage_version,transport_summary,prompt_tokens FROM ai_generation_runs')).rows)
            .toEqual([{ lineage_version: null,transport_summary: null,prompt_tokens: 17 }]);
        const columns = (target: PGlite) => target.query("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_name IN ('ai_generation_runs','ai_result_exposures','ai_selection_observations') ORDER BY table_name,column_name").then(r => r.rows);
        expect(await columns(old)).toEqual(await columns(db));
    } finally { await old.close(); }
    const exposure = await getSuggestionsResult(address,'electric',context());
    await db.query(`INSERT INTO ai_result_exposures (request_id,edit_version,mode,feature,category,delivery_kind,lookup_state,service_duration_ms,origin_metadata)
        SELECT $1,0,'live','provider_suggestions','water','cache','origin_unavailable',0,$2::jsonb FROM generate_series(1,5000)`,[TWO,JSON.stringify(origin)]);
    await db.exec('ANALYZE ai_result_exposures');
    const plan = await query('EXPLAIN SELECT id FROM ai_result_exposures WHERE request_id=$1 AND edit_version=0 AND category=$2 ORDER BY created_at DESC LIMIT 10',[ONE,'electric']);
    expect(JSON.stringify(plan)).toContain('idx_ai_exposures_request_edit_category');
    expect(exposure.exposure).toBeDefined();
});
it('bounds future transport expansion and preserves unknown completeness on truncation', () => {
    const attempt = { pass: 0 as const,role: 'primary' as const,index: 1,elapsedMs: 1,outcome: 'answered' as const,failure: null,
        usage,candidates: 1,queryCandidates: 1,sourceCandidates: 1 };
    const summary = mergeTransport(Array.from({ length: 4 },() => ({ ...emptyTransport(null,true),attempts: [attempt,attempt,attempt] })))!;
    expect(summary.attempts).toHaveLength(9);expect(summary.truncated).toBe(true);
    expect(transportCoverage(summary).promptTokens.coverage).toBe('partial');
});
