import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    buildSilverCases,
    caseAddress,
    cleanProviderName,
    matchProviderName,
    maxPassesPerCase,
    parseCases,
    percentile,
    renderComparison,
    scoreCase,
    selectCases,
    summarize,
    toCsv,
    tokenCostUsd,
    websiteDomain,
    type CaseRun,
    type EvalCase,
    type SilverRow,
} from '@/scripts/eval/eval-core';
import { buildLocationContext, parseAddressWithConfidence } from '@/lib/address/location-parser';

function row(overrides: Partial<SilverRow>): SilverRow {
    return {
        city: 'Mechanicsburg',
        state: 'PA',
        zip: '17050',
        category: 'electric',
        entry_mode: 'suggested_confirmed',
        display_name: 'PPL Electric Utilities',
        ...overrides,
    };
}

function evalCase(overrides: Partial<EvalCase> = {}): EvalCase {
    return {
        id: 'pa-17050-mechanicsburg-electric',
        kind: 'silver',
        city: 'Mechanicsburg',
        state: 'PA',
        zip: '17050',
        category: 'electric',
        accepted: ['PPL Electric Utilities'],
        ...overrides,
    };
}

function run(names: string[], overrides: Partial<CaseRun> = {}): CaseRun {
    return {
        suggestions: names.map((display_name) => ({ display_name })),
        source: 'ai_verify',
        upstreamReasonCode: null,
        errorKind: null,
        attemptCount: 2,
        latencyMs: 8000,
        usage: {
            promptTokens: 900,
            outputTokens: 600,
            thinkingTokens: 100,
            toolPromptTokens: 4000,
            searchQueryCount: 3,
            sourceCount: 5,
        },
        ...overrides,
    };
}

describe('evaluation cases', () => {
    it('drops typed answers that are not provider names', () => {
        expect(cleanProviderName('  PPL   Electric ')).toBe('PPL Electric');
        expect(cleanProviderName('call 717-555-0100')).toBeNull();
        expect(cleanProviderName('someone@example.com')).toBeNull();
        expect(cleanProviderName('www.example.com')).toBeNull();
        expect(cleanProviderName('N/A')).toBeNull();
        expect(cleanProviderName('Municipal Water Authority')).toBeNull();
        expect(cleanProviderName('x')).toBeNull();
        expect(cleanProviderName('a'.repeat(61))).toBeNull();
        expect(cleanProviderName(null)).toBeNull();
    });

    it('groups answers by locality and category and collapses spellings', () => {
        const cases = buildSilverCases([
            row({}),
            row({ display_name: 'PPL Electric Utilities' }),
            row({ display_name: 'ppl electric utilities inc', entry_mode: 'free_text' }),
            row({ display_name: 'Met-Ed', entry_mode: 'search_selected' }),
            row({ category: 'water', display_name: 'PA American Water', entry_mode: 'free_text' }),
            row({ city: 'Camp Hill', zip: '17011' }),
        ]);

        expect(cases.map((item) => item.id)).toEqual([
            'pa-17011-camp-hill-electric',
            'pa-17050-mechanicsburg-electric',
            'pa-17050-mechanicsburg-water',
        ]);
        const electric = cases[1];
        expect(electric.accepted).toEqual(['PPL Electric Utilities', 'Met-Ed']);
        expect(electric.confirmations).toBe(4);
        expect(electric.origin).toBe('mixed');
        expect(cases[0].origin).toBe('suggested');
        expect(cases[2].origin).toBe('typed');
        expect(cases.every((item) => item.kind === 'silver')).toBe(true);
    });

    it('skips rows without a full locality, a known category or a usable name', () => {
        expect(buildSilverCases([
            row({ city: '' }),
            row({ state: 'Pennsylvania' }),
            row({ zip: '1705' }),
            row({ category: 'hoa' }),
            row({ display_name: 'not sure' }),
        ])).toEqual([]);
    });

    it('keeps only the approved fields in a case', () => {
        const [item] = buildSilverCases([row({})]);
        expect(Object.keys(item).sort()).toEqual([
            'accepted', 'category', 'city', 'confirmations', 'id', 'kind', 'origin', 'state', 'zip',
        ]);
    });

    it('rejects a case file with a missing field', () => {
        expect(() => parseCases({}, 'hard')).toThrow(/JSON array/);
        expect(() => parseCases([{ city: 'Austin', state: 'TX', zip: '78704', category: 'electric' }], 'hard'))
            .toThrow(/accepted/);
        expect(() => parseCases([{ city: 'Austin', state: 'TX', zip: '787', category: 'electric', accepted: ['Austin Energy'] }], 'hard'))
            .toThrow(/zip/);
    });

    it.each(['hard-cases.json', 'local-hard-cases.json'])('reads the committed %s', (name) => {
        const file = path.resolve(__dirname, '../../scripts/eval/cases', name);
        const cases = parseCases(JSON.parse(readFileSync(file, 'utf8')), 'hard');
        expect(cases.length).toBeGreaterThanOrEqual(10);
        expect(new Set(cases.map((item) => item.id)).size).toBe(cases.length);
        expect(cases.every((item) => item.kind === 'hard' && item.note)).toBe(true);
    });

    it('selects the same spread of cases for the same seed', () => {
        const cases = buildSilverCases([
            row({}),
            row({ category: 'water', display_name: 'Pennsylvania American Water' }),
            row({ city: 'Camp Hill', zip: '17011' }),
            row({ city: 'Camp Hill', zip: '17011', category: 'water', display_name: 'Pennsylvania American Water' }),
            row({ city: 'Carlisle', zip: '17013' }),
            row({ city: 'York', zip: '17401', category: 'trash', display_name: 'Waste Management' }),
        ]);

        const first = selectCases(cases, 3, 'a');
        expect(selectCases(cases, 3, 'a')).toEqual(first);
        expect(first).toHaveLength(3);
        // Categories take turns and no locality repeats while another is unused.
        expect(new Set(first.map((item) => item.category)).size).toBe(3);
        expect(new Set(first.map((item) => item.zip)).size).toBe(3);
        expect(selectCases(cases, 99, 'a')).toHaveLength(cases.length);
    });

    it('builds an address the parser reads back with high confidence and no street in the prompt context', () => {
        const item = evalCase({ city: 'Kansas City', state: 'MO', zip: '64106' });
        const parsed = parseAddressWithConfidence(caseAddress(item));
        expect(parsed).toMatchObject({ city: 'Kansas City', state: 'MO', zip: '64106', confidence: 'high' });
        expect(buildLocationContext(parsed).lines.join('\n')).not.toMatch(/Main St/i);
    });
});

describe('evaluation matching', () => {
    it('matches exact names through the canonical key', () => {
        expect(matchProviderName('PA American Water', ['Pennsylvania American Water'])).toBe('exact');
        expect(matchProviderName('PPL Electric Utilities, Inc.', ['PPL Electric Utilities'])).toBe('exact');
        expect(matchProviderName('Kauaʻi Island Utility Cooperative', ['Kauai Island Utility Cooperative'])).toBe('exact');
        expect(matchProviderName('Hellers Gas', ['Heller’s Gas'])).toBe('exact');
    });

    it('matches partially when the identifying words of one name are in the other', () => {
        expect(matchProviderName('PPL Electric', ['PPL Electric Utilities Corporation of PA'])).toBe('partial');
        expect(matchProviderName('Hampden Township Sewer Authority', ['Hampden Township'])).toBe('partial');
        expect(matchProviderName('Duke Energy Progress', ['Duke Energy'])).toBe('partial');
    });

    it('does not match different providers or names with no identifying word', () => {
        expect(matchProviderName('Met-Ed', ['PPL Electric Utilities'])).toBeNull();
        expect(matchProviderName('Municipal Water Authority', ['City Water Department'])).toBeNull();
        expect(matchProviderName('', ['PPL'])).toBeNull();
    });

    it('reads a website domain', () => {
        expect(websiteDomain('https://www.PPLelectric.com/start')).toBe('pplelectric.com');
        expect(websiteDomain('pplelectric.com')).toBe('pplelectric.com');
        expect(websiteDomain(null)).toBeNull();
    });
});

describe('evaluation scoring', () => {
    it('scores rank, extras, usage and cost for an answered case', () => {
        const score = scoreCase(
            evalCase({ website_domain: 'pplelectric.com', phone: '1-800-342-5775' }),
            run(['Met-Ed', 'PPL Electric', 'UGI'], {
                suggestions: [
                    { display_name: 'Met-Ed' },
                    { display_name: 'PPL Electric', contact_website: 'https://www.pplelectric.com', contact_phone: '(800) 342-5775' },
                    { display_name: 'UGI' },
                ],
            }),
            'gemini-3.1-flash-lite'
        );

        expect(score).toMatchObject({
            served: 'ai',
            top1: null,
            top3: 'partial',
            first_match_rank: 2,
            extra_count: 2,
            unsourced_extra_count: 0,
            website_match: true,
            phone_match: true,
            passes: 2,
            search_queries: 3,
            returned_names: 'Met-Ed | PPL Electric | UGI',
        });
        // 900 input at $0.25 and 700 output (thinking included) at $1.50 per 1M.
        expect(score.token_cost_usd).toBeCloseTo((900 * 0.25 + 700 * 1.5) / 1_000_000, 10);
    });

    it('marks the generic list and extras without a source', () => {
        const fallback = scoreCase(evalCase(), run(['Duke Energy'], { source: 'fallback', usage: null, attemptCount: 3 }), 'gemini-3.1-flash-lite');
        expect(fallback).toMatchObject({ served: 'fallback', top1: null, top3: null, token_cost_usd: null, unsourced_extra_count: 0 });

        const unsourced = scoreCase(
            evalCase(),
            run(['PPL Electric Utilities', 'Made Up Power'], {
                usage: { promptTokens: 1, outputTokens: 1, thinkingTokens: null, toolPromptTokens: null, searchQueryCount: 0, sourceCount: 0 },
            }),
            'unknown-model'
        );
        expect(unsourced).toMatchObject({ top1: 'exact', unsourced_extra_count: 1, token_cost_usd: null, website_match: null });
    });

    it('prices tokens only for a known model with reported usage', () => {
        expect(tokenCostUsd(null, 'gemini-3.1-flash-lite')).toBeNull();
        expect(tokenCostUsd({ promptTokens: null, outputTokens: null, thinkingTokens: null, toolPromptTokens: null, searchQueryCount: 2, sourceCount: 1 }, 'gemini-3.1-flash-lite')).toBeNull();
    });

    it('computes nearest-rank percentiles', () => {
        expect(percentile([], 50)).toBeNull();
        expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
        expect(percentile([5, 1, 3, 2, 4], 95)).toBe(5);
        expect(percentile([7], 95)).toBe(7);
    });

    it('adds up a run and renders the table and the CSV', () => {
        const scores = [
            scoreCase(evalCase(), run(['PPL Electric Utilities', 'Met-Ed']), 'gemini-3.1-flash-lite'),
            scoreCase(evalCase({ id: 'b', category: 'trash', accepted: ['Waste Management'] }), run(['Republic Services', 'WM'], { latencyMs: 12000 }), 'gemini-3.1-flash-lite'),
            scoreCase(evalCase({ id: 'c' }), run(['Duke Energy'], { source: 'fallback', usage: null, errorKind: 'timeout', upstreamReasonCode: 'ai_provider_error', attemptCount: 1, latencyMs: 15000 }), 'gemini-3.1-flash-lite'),
        ];
        const summary = summarize(scores);

        expect(summary).toMatchObject({
            cases: 3,
            top1: 1,
            top1_exact: 1,
            top3: 2,
            fallback: 1,
            model_errors: 1,
            parse_errors: 0,
            passes: 5,
            latency_p50_ms: 12000,
            latency_p95_ms: 15000,
            single_provider_cases: 1,
            single_provider_extras_avg: 1,
            search_queries: 6,
            cases_with_usage: 2,
        });
        expect(summary.search_cost_usd).toBeCloseTo(6 * 0.014, 10);
        expect(summary.cost_per_top3_usd).toBeCloseTo(((summary.token_cost_usd ?? 0) + 6 * 0.014) / 2, 10);

        const config = { label: 'now', model: 'gemini-3.1-flash-lite', thinking: 'low', passes: 'two' as const, recovery: true, grounding: true };
        const table = renderComparison([{ config, summary }, { config: { ...config, label: 'one-pass', passes: 'one' }, summary }]);
        expect(table).toContain('| Measure | now | one-pass |');
        expect(table).toContain('| Correct answer in top 3 | 2/3 (67%) | 2/3 (67%) |');
        expect(table).toContain('| Passes | two + recovery | one + recovery |');

        const csv = toCsv(scores);
        const lines = csv.trim().split('\r\n');
        expect(lines).toHaveLength(4);
        expect(lines[0].split(',')[0]).toBe('case_id');
        expect(toCsv([])).toBe('');
        expect(toCsv([{ ...scores[0], returned_names: 'A, "B"' }])).toContain('"A, ""B"""');
    });

    it('counts the model calls a configuration can make per case', () => {
        expect(maxPassesPerCase({ passes: 'two', recovery: true })).toBe(3);
        expect(maxPassesPerCase({ passes: 'one', recovery: true })).toBe(2);
        expect(maxPassesPerCase({ passes: 'one', recovery: false })).toBe(1);
    });
});
