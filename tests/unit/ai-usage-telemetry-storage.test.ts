// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSchemaDatabase, queryRows } from '../helpers/pglite-db';

const mocks = vi.hoisted(() => ({ sql: vi.fn() }));
vi.mock('@/lib/neon/db', () => ({ sql: { query: mocks.sql } }));

import { createAiSuggestionRun, markAiSuggestionSelection, type CreateAiSuggestionRunInput } from '@/lib/neon/queries/ai-telemetry';

// Real schema.sql in disposable embedded PostgreSQL; no environment or credentials are read.
let db: PGlite;

const run = (overrides: Partial<CreateAiSuggestionRunInput> = {}): CreateAiSuggestionRunInput => ({
    feature: 'provider_suggestions',
    category: 'electric',
    provider: 'gemini',
    model: 'gemini-test',
    promptVersion: 'provider-suggestions-v1',
    servedPipeline: 'new',
    source: 'ai_verify',
    status: 'success',
    reasonCode: null,
    upstreamReasonCode: null,
    latencyMs: 4200,
    attemptCount: 2,
    localityState: 'PA',
    localityZip3: '170',
    localityCity: 'Mechanicsburg',
    suggestionCount: 0,
    suggestions: [],
    ...overrides,
});

const USAGE_COLUMNS = `prompt_tokens, output_tokens, thinking_tokens, tool_prompt_tokens,
    search_query_count, source_count, thinking_level, error_kind`;
const columns = async (target: PGlite) => (await target.query<{ c: string }>(`
    SELECT column_name || ':' || data_type || ':' || is_nullable AS c FROM information_schema.columns
    WHERE table_name = 'ai_generation_runs' ORDER BY 1`)).rows.map((row) => row.c);

beforeAll(async () => {
    db = await createSchemaDatabase();
    mocks.sql.mockImplementation((text: string, values: unknown[]) => queryRows(db, text, values));
}, 60000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => { await db.exec('TRUNCATE ai_generation_runs CASCADE'); });

describe('AI usage telemetry storage', () => {
    it('persists items and selection correlation through the bounded parameterized writers', async () => {
        const accountId = '00000000-0000-4000-8000-000000000001';
        const requestId = '00000000-0000-4000-8000-000000000002';
        await db.exec(`
            INSERT INTO accounts (id, email) VALUES ('${accountId}', 'fixture@example.test');
            INSERT INTO requests (id, account_id, property_address, public_token, seller_token)
            VALUES ('${requestId}', '${accountId}', '123 Fixture St', 'fixture-public', 'fixture-seller');
        `);
        const id = await createAiSuggestionRun(run({
            requestId, accountId, suggestionCount: 1,
            suggestions: [{ display_name: 'Fixture Electric', canonical_id: 'fixture-electric', confidence: 0.9 }],
        }));
        expect(id).not.toBeNull();
        await markAiSuggestionSelection({
            requestId, category: 'electric', selectedName: '  Fixture Electric ',
            finalEntryMode: 'suggested_confirmed', canonicalId: 'fixture-electric', confidenceScore: 0.9,
        });
        expect(await queryRows(db, `SELECT run_id, rank, display_name, normalized_name, selected_by_seller,
            final_entry_mode, final_canonical_id FROM ai_suggestion_items`)).toEqual([{
            run_id: id, rank: 1, display_name: 'Fixture Electric', normalized_name: 'fixture electric',
            selected_by_seller: true, final_entry_mode: 'suggested_confirmed', final_canonical_id: 'fixture-electric',
        }]);
    });

    it('returns a telemetry fallback with one marker when item failure leaves a partial run', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        await db.exec(`
            CREATE OR REPLACE FUNCTION test_fail_ai_item() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN RAISE EXCEPTION 'private SQL sentinel'; END $$;
            CREATE TRIGGER test_fail_ai_item BEFORE INSERT ON ai_suggestion_items FOR EACH ROW EXECUTE FUNCTION test_fail_ai_item();
        `);
        try {
            expect(await createAiSuggestionRun(run({
                suggestionCount: 1, suggestions: [{ display_name: 'Fixture Electric', confidence: 0.9 }],
            }))).toBeNull();
        } finally {
            await db.exec('DROP TRIGGER test_fail_ai_item ON ai_suggestion_items');
        }
        expect(await queryRows(db, 'SELECT id FROM ai_generation_runs')).toHaveLength(1);
        expect(await queryRows(db, 'SELECT id FROM ai_suggestion_items')).toEqual([]);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(warn.mock.calls)).not.toContain('private SQL sentinel');
        warn.mockRestore();
    });

    it('stores the usage, thinking level and failure kind of a fresh run', async () => {
        await createAiSuggestionRun(run({
            usage: { promptTokens: 1050, outputTokens: 100, thinkingTokens: null, toolPromptTokens: 2000, searchQueryCount: 3, sourceCount: 6 },
            thinkingLevel: 'low',
            errorKind: 'timeout',
        }));

        expect(await queryRows(db, `SELECT ${USAGE_COLUMNS} FROM ai_generation_runs`)).toEqual([{
            prompt_tokens: 1050, output_tokens: 100, thinking_tokens: null, tool_prompt_tokens: 2000,
            search_query_count: 3, source_count: 6, thinking_level: 'low', error_kind: 'timeout',
        }]);
    });

    it('leaves the usage columns empty for a cache hit', async () => {
        await createAiSuggestionRun(run({ source: 'cache', cacheHit: true, attemptCount: 0, latencyMs: 0 }));

        expect(await queryRows(db, `SELECT cache_hit, ${USAGE_COLUMNS} FROM ai_generation_runs`)).toEqual([{
            cache_hit: true, prompt_tokens: null, output_tokens: null, thinking_tokens: null, tool_prompt_tokens: null,
            search_query_count: null, source_count: null, thinking_level: null, error_kind: null,
        }]);
    });

    it('accepts a contact lookup with no category and stores no item rows', async () => {
        await createAiSuggestionRun(run({
            feature: 'provider_contact', category: null, promptVersion: 'provider-contact-v1',
            servedPipeline: null, source: 'ai_primary', attemptCount: 1, suggestionCount: 1,
            usage: { promptTokens: 300, outputTokens: 40, thinkingTokens: 20, toolPromptTokens: 900, searchQueryCount: 2, sourceCount: 1 },
        }));

        expect(await queryRows(db, `SELECT feature, category, suggestion_count, search_query_count FROM ai_generation_runs`))
            .toEqual([{ feature: 'provider_contact', category: null, suggestion_count: 1, search_query_count: 2 }]);
        expect(await queryRows(db, 'SELECT 1 FROM ai_suggestion_items')).toEqual([]);
    });

    it('drops counts that are not usable numbers instead of failing the insert', async () => {
        await createAiSuggestionRun(run({
            usage: { promptTokens: Number.NaN, outputTokens: -5, thinkingTokens: 12.6, toolPromptTokens: null, searchQueryCount: 1, sourceCount: 0 },
        }));

        expect(await queryRows(db, `SELECT prompt_tokens, output_tokens, thinking_tokens, source_count FROM ai_generation_runs`))
            .toEqual([{ prompt_tokens: null, output_tokens: null, thinking_tokens: 13, source_count: 0 }]);
    });
});

describe('migrations-ai-usage-telemetry.sql', () => {
    const migration = readFileSync('migrations-ai-usage-telemetry.sql', 'utf8');

    async function deployedDatabase(withOperations: boolean): Promise<PGlite> {
        const fresh = new PGlite({ extensions: { uuid_ossp } });
        await fresh.exec(`
            CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
            CREATE TABLE accounts (id UUID PRIMARY KEY);
            CREATE TABLE organizations (id UUID PRIMARY KEY);
            CREATE TABLE requests (id UUID PRIMARY KEY);
        `);
        await fresh.exec(readFileSync('migrations-ai-telemetry.sql', 'utf8'));
        if (withOperations) await fresh.exec(readFileSync('migrations-operational-events.sql', 'utf8'));
        await fresh.exec(`
            INSERT INTO ai_generation_runs (feature, category, prompt_version, source, status, latency_ms, attempt_count, suggestion_count)
            VALUES ('provider_search', 'water', 'provider-search-v2', 'ai_primary', 'success', 3100, 1, 2)
        `);
        return fresh;
    }
    const existingRow = (target: PGlite) => queryRows(target,
        `SELECT feature, category, prompt_version, source, status, latency_ms, attempt_count, suggestion_count, cache_hit FROM ai_generation_runs`);

    it('gives a deployed database the shape schema.sql declares, keeps its rows and can run twice', async () => {
        const fresh = await deployedDatabase(true);
        const before = await existingRow(fresh);

        await fresh.exec(migration);
        await fresh.exec(migration);

        expect(await columns(fresh)).toEqual(await columns(db));
        expect(await existingRow(fresh)).toEqual(before);
        expect(await queryRows(fresh, `SELECT ${USAGE_COLUMNS} FROM ai_generation_runs`)).toEqual([{
            prompt_tokens: null, output_tokens: null, thinking_tokens: null, tool_prompt_tokens: null,
            search_query_count: null, source_count: null, thinking_level: null, error_kind: null,
        }]);

        await fresh.exec(`
            INSERT INTO ai_generation_runs (feature, prompt_version, status) VALUES ('provider_contact', 'provider-contact-v1', 'success');
            INSERT INTO operational_events (category, code, outcome, fingerprint) VALUES ('ai', 'provider_search_degraded', 'failure', 'ai:provider_search_degraded');
        `);
        await expect(fresh.exec(`INSERT INTO ai_generation_runs (feature, prompt_version, status) VALUES ('other', 'v', 'success')`))
            .rejects.toThrow(/ai_generation_runs_feature_check/);
        await expect(fresh.exec(`INSERT INTO operational_events (category, code, outcome, fingerprint) VALUES ('other', 'x', 'failure', 'other:x')`))
            .rejects.toThrow(/operational_events_category_check/);
        expect(await queryRows(fresh, `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_ai_generation_runs_created'`)).toHaveLength(1);
        await fresh.close();
    });

    it('applies where operational monitoring is not installed', async () => {
        const fresh = await deployedDatabase(false);
        await fresh.exec(migration);
        expect(await columns(fresh)).toEqual(await columns(db));
        await fresh.close();
    });
});
