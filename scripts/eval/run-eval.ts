import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
    caseAddress,
    maxPassesPerCase,
    parseCases,
    renderComparison,
    scoreCase,
    selectCases,
    summarize,
    toCsv,
    type CaseScore,
    type EvalCase,
    type EvalConfig,
    type EvalResultFile,
} from './eval-core';

/**
 * Runs the provider-suggestion pipeline on the evaluation cases with one
 * configuration and writes a CSV and a JSON result to the ignored `.eval/`
 * folder. See scripts/eval/README.md.
 *
 * Without --yes it only prints the plan. With --yes it calls the real model:
 * each case costs up to three model calls, and each call can run several
 * Google searches from the monthly allowance production shares.
 */

const SILVER_CASES = path.join('.eval', 'cases', 'silver.json');
const HARD_CASES = path.join('scripts', 'eval', 'cases', 'hard-cases.json');
const RESULTS_DIR = path.join('.eval', 'results');
const CIRCUIT_WAIT_MS = 61_000;
const MAX_CONSECUTIVE_FAILURES = 4;

interface Options {
    config: EvalConfig;
    silverLimit: number | null;
    hardLimit: number | null;
    /** Silver cases need this many seller answers behind them. */
    minConfirmations: number;
    seed: string;
    concurrency: number;
    confirmed: boolean;
    silverPath: string;
    hardPath: string;
}

function flag(args: string[], name: string): string | undefined {
    const index = args.indexOf(`--${name}`);
    return index !== -1 ? args[index + 1] : undefined;
}

function oneOf<T extends string>(name: string, value: string | undefined, allowed: readonly T[], fallback: T): T {
    if (value === undefined) return fallback;
    if (!(allowed as readonly string[]).includes(value)) {
        throw new Error(`--${name} must be one of: ${allowed.join(', ')}`);
    }
    return value as T;
}

function wholeNumber(name: string, value: string | undefined): number | null {
    if (value === undefined) return null;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`--${name} must be a whole number.`);
    return parsed;
}

function readOptions(args: string[]): Options {
    const model = flag(args, 'model') || 'gemini-3.1-flash-lite';
    const thinking = oneOf('thinking', flag(args, 'thinking'), ['default', 'minimal', 'low', 'medium', 'high'] as const, 'low');
    const passes = oneOf('passes', flag(args, 'passes'), ['one', 'two'] as const, 'two');
    const recovery = oneOf('recovery', flag(args, 'recovery'), ['on', 'off'] as const, 'on') === 'on';
    const grounding = oneOf('grounding', flag(args, 'grounding'), ['on', 'off'] as const, 'on') === 'on';
    const locality = oneOf('locality', flag(args, 'locality'), ['on', 'off'] as const, 'off') === 'on';
    const label = (flag(args, 'label') || `${model}-${thinking}-${passes}pass${grounding ? '' : '-nosearch'}${locality ? '-locality' : ''}`)
        .toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '');
    return {
        config: { label, model, thinking, passes, recovery, grounding, locality },
        silverLimit: wholeNumber('silver', flag(args, 'silver')),
        hardLimit: wholeNumber('hard', flag(args, 'hard')),
        minConfirmations: wholeNumber('min-confirmations', flag(args, 'min-confirmations')) ?? 2,
        seed: flag(args, 'seed') || 'eval',
        concurrency: Math.max(1, Math.min(4, wholeNumber('concurrency', flag(args, 'concurrency')) ?? 2)),
        confirmed: args.includes('--yes'),
        silverPath: flag(args, 'silver-cases') || SILVER_CASES,
        hardPath: flag(args, 'hard-cases') || HARD_CASES,
    };
}

async function loadCases(options: Options): Promise<EvalCase[]> {
    const read = async (file: string, kind: 'silver' | 'hard', limit: number | null) => {
        if (limit === 0) return [];
        if (!existsSync(file)) {
            console.warn(`No ${kind} case file at ${file}; skipping.`);
            return [];
        }
        const cases = parseCases(JSON.parse(await readFile(file, 'utf8')), kind)
            .filter((item) => kind === 'hard' || (item.confirmations ?? 0) >= options.minConfirmations);
        return limit === null ? cases : selectCases(cases, limit, options.seed);
    };
    return [
        ...await read(options.silverPath, 'silver', options.silverLimit),
        ...await read(options.hardPath, 'hard', options.hardLimit),
    ];
}

/**
 * The pipeline reads its settings from the environment, the model name once at
 * import. Set them first, and remove everything that could reach the live
 * database or cache or change the pipeline in a way the result does not record.
 */
function applyEnvironment(config: EvalConfig): void {
    for (const name of [
        'DATABASE_URL',
        'UPSTASH_REDIS_REST_URL',
        'UPSTASH_REDIS_REST_TOKEN',
        'LOCATION_VERIFIER_ENDPOINT',
        'SUGGESTIONS_SHADOW_MODE',
        'SUGGESTIONS_SERVE_NEW_PIPELINE',
        'SUGGESTIONS_CANARY_PERCENT',
        'SUGGESTIONS_MAX_TOTAL_MS',
        'SUGGESTIONS_DEADLINE_MS',
        'SUGGESTIONS_MIN_VALID_RESULTS',
        'SUGGESTIONS_MIN_TOP_CONFIDENCE',
        'GEMINI_CALL_TIMEOUT_MS',
        'INCLUDE_AI_SUGGESTION_CONTACTS',
    ]) {
        delete process.env[name];
    }
    process.env.GEMINI_MODEL_NAME = config.model;
    if (config.thinking === 'default') delete process.env.GEMINI_THINKING_LEVEL;
    else process.env.GEMINI_THINKING_LEVEL = config.thinking;
    process.env.GEMINI_GOOGLE_SEARCH_GROUNDING = config.grounding ? 'true' : 'false';
    process.env.SUGGESTIONS_TWO_PASS_VERIFY = config.passes === 'two' ? 'true' : 'false';
    process.env.SUGGESTIONS_ENABLE_RECOVERY_PASS = config.recovery ? 'true' : 'false';
}

function currentCommit(): string {
    try {
        const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
        const dirty = execFileSync('git', ['status', '--porcelain', '--', 'lib'], { encoding: 'utf8' }).trim();
        return dirty ? `${head}+changes` : head;
    } catch {
        return 'unknown';
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
    const options = readOptions(process.argv.slice(2));
    const { config } = options;
    const cases = await loadCases(options);
    const maxCalls = cases.length * maxPassesPerCase(config);

    console.log(`Configuration "${config.label}": model ${config.model}, thinking ${config.thinking}, ${config.passes} pass(es), recovery ${config.recovery ? 'on' : 'off'}, search ${config.grounding ? 'on' : 'off'}`);
    console.log(`Cases: ${cases.length} (${cases.filter((item) => item.kind === 'silver').length} silver, ${cases.filter((item) => item.kind === 'hard').length} hard)`);
    if (config.locality) {
        console.log(`County or municipality sent for ${cases.filter((item) => item.county || item.municipality).length} of ${cases.length} cases.`);
    }
    console.log(`Model calls: at most ${maxCalls}. ${config.grounding ? 'Each call can run several Google searches from the shared monthly allowance.' : 'No searches.'}`);

    if (cases.length === 0) {
        throw new Error('No cases to run.');
    }
    if (!options.confirmed) {
        console.log('Plan only. Add --yes to call the model.');
        return;
    }

    applyEnvironment(config);
    const { getSuggestionsFresh } = await import('@/lib/providers/suggestion-service');
    const { getGeminiModelName, getGeminiThinkingLevelName, isGeminiConfigured } = await import('@/lib/ai/gemini-client');
    const { parseAddressWithConfidence } = await import('@/lib/address/location-parser');
    if (!isGeminiConfigured()) {
        throw new Error('GOOGLE_AI_API_KEY or GEMINI_API_KEY is not set.');
    }
    if (getGeminiModelName() !== config.model) {
        throw new Error(`The pipeline loaded model "${getGeminiModelName()}", not "${config.model}".`);
    }
    if (config.thinking !== getGeminiThinkingLevelName()) {
        throw new Error(`The pipeline would send thinking "${getGeminiThinkingLevelName()}", not "${config.thinking}".`);
    }

    const startedAt = new Date();
    const rows: CaseScore[] = new Array(cases.length);
    let next = 0;
    let done = 0;
    let consecutiveFailures = 0;
    let stopped = false;

    const runOne = async (item: EvalCase) => {
        const address = caseAddress(item);
        const parsed = parseAddressWithConfidence(address);
        if (parsed.city !== item.city || parsed.state !== item.state || parsed.zip !== item.zip) {
            console.warn(`  ${item.id}: the address parser read "${parsed.city}, ${parsed.state} ${parsed.zip}".`);
        }
        const locality = config.locality ? { county: item.county, municipality: item.municipality } : undefined;
        let result = await getSuggestionsFresh(address, item.category, locality);
        if (result.outcome.errorKind === 'circuit_open') {
            console.warn(`  ${item.id}: circuit breaker open, waiting ${CIRCUIT_WAIT_MS / 1000} s and trying once more.`);
            await sleep(CIRCUIT_WAIT_MS);
            result = await getSuggestionsFresh(address, item.category, locality);
        }
        return scoreCase(item, {
            suggestions: result.suggestions,
            source: result.outcome.source,
            upstreamReasonCode: result.outcome.upstreamReasonCode,
            errorKind: result.outcome.errorKind ?? null,
            attemptCount: result.outcome.attemptCount,
            latencyMs: result.outcome.latencyMs,
            usage: result.outcome.usage ?? null,
        }, config.model);
    };

    const worker = async () => {
        while (!stopped) {
            const index = next++;
            if (index >= cases.length) return;
            const score = await runOne(cases[index]);
            rows[index] = score;
            done++;
            consecutiveFailures = score.error_kind ? consecutiveFailures + 1 : 0;
            console.log(`  ${done}/${cases.length} ${score.case_id}: ${score.served}${score.top3 ? ', answer in top 3' : ', no accepted answer'}${score.error_kind ? `, ${score.error_kind}` : ''} (${(score.latency_ms / 1000).toFixed(1)} s, ${score.passes} call(s), ${score.search_queries ?? '?'} search(es))`);
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                stopped = true;
                console.error(`Stopping: ${consecutiveFailures} cases in a row ended with a model call failure.`);
            }
        }
    };
    await Promise.all(Array.from({ length: options.concurrency }, worker));

    const finished = rows.filter(Boolean);
    const result: EvalResultFile = {
        config,
        started_at: startedAt.toISOString(),
        commit: currentCommit(),
        summary: summarize(finished),
        rows: finished,
    };
    await mkdir(RESULTS_DIR, { recursive: true });
    const stamp = startedAt.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const base = path.join(RESULTS_DIR, `${stamp}-${config.label}`);
    await writeFile(`${base}.json`, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    await writeFile(`${base}.csv`, toCsv(finished), 'utf8');

    console.log(`\n${renderComparison([result])}\n`);
    console.log(`Wrote ${base}.json and ${base}.csv`);
    if (stopped) process.exitCode = 1;
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
