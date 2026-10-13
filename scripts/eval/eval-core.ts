import { canonicalProviderKey } from '@/lib/providers/canonicalize';
import type { UtilityCategory } from '@/types';

/**
 * Pure parts of the provider-suggestion evaluation: case building, name
 * matching, scoring, totals and output. No database, network or model call
 * happens here, so all of it is unit tested.
 */

export const EVAL_CATEGORIES: UtilityCategory[] = [
    'electric', 'gas', 'water', 'sewer', 'trash', 'propane', 'oil', 'internet', 'cable',
];

/** Categories where one provider serves an address, so extra names are padding. */
export const SINGLE_PROVIDER_CATEGORIES: UtilityCategory[] = ['electric', 'gas', 'water', 'sewer'];

export type CaseKind = 'silver' | 'hard';
/** Whether sellers picked a name the product suggested, or typed or searched for it. */
export type CaseOrigin = 'suggested' | 'typed' | 'mixed';

export interface EvalCase {
    id: string;
    kind: CaseKind;
    city: string;
    state: string;
    zip: string;
    category: UtilityCategory;
    /** Provider names counted as correct. Silver: most confirmed first. */
    accepted: string[];
    /** Silver only: seller answers behind the accepted names. */
    confirmations?: number;
    origin?: CaseOrigin;
    /** Hard cases: what makes the case hard. */
    note?: string;
    /** Hard cases: whether the answer was checked against the provider's own site. */
    verified?: boolean;
    website_domain?: string;
    phone?: string;
    /** Sent to the model only with `--locality on`. */
    county?: string;
    /** Township or other local government, where the city is only a mailing name. */
    municipality?: string;
}

export interface SilverRow {
    city: string | null;
    state: string | null;
    zip: string | null;
    category: string | null;
    entry_mode: string | null;
    display_name: string | null;
}

// ---------------------------------------------------------------------------
// Case building
// ---------------------------------------------------------------------------

// Names the product's own generic list offers, and non-answers sellers type.
const NON_ANSWERS = new Set([
    'municipal water authority',
    'municipal sewer authority',
    'municipal sanitation',
    'n a',
    'na',
    'none',
    'unknown',
    'not sure',
    'unsure',
    'test',
    'septic',
    'well',
    'private well',
    'private septic',
    'no',
    'yes',
    'same',
    'city',
    'county',
    'town',
    'township',
]);

function plainTokens(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * A typed provider name that is safe and useful as an accepted answer. Drops
 * anything that looks like contact details or a sentence instead of a name.
 */
export function cleanProviderName(raw: string | null | undefined): string | null {
    const name = String(raw || '').replace(/\s+/g, ' ').trim();
    if (name.length < 2 || name.length > 60) return null;
    if (name.includes('@') || /https?:|www\./i.test(name)) return null;
    if ((name.match(/\d/g) || []).length >= 5) return null;
    if (NON_ANSWERS.has(plainTokens(name))) return null;
    if (!canonicalProviderKey(name)) return null;
    return name;
}

function slug(value: string): string {
    return plainTokens(value).replace(/ /g, '-');
}

function titleCaseCity(city: string): string {
    return city.replace(/\s+/g, ' ').trim();
}

/**
 * Group seller answers into one case per locality and category. Spellings of
 * one provider collapse through the product's canonical key; the most common
 * spelling is kept. Rows without a city, a state or a 5-digit ZIP are skipped.
 */
export function buildSilverCases(rows: SilverRow[]): EvalCase[] {
    interface Cluster { count: number; spellings: Map<string, number> }
    interface Group {
        city: string; state: string; zip: string; category: UtilityCategory;
        clusters: Map<string, Cluster>;
        suggested: number; typed: number;
    }
    const groups = new Map<string, Group>();

    for (const row of rows) {
        const category = row.category as UtilityCategory;
        if (!EVAL_CATEGORIES.includes(category)) continue;
        const city = titleCaseCity(row.city || '');
        const state = (row.state || '').trim().toUpperCase();
        const zip = (row.zip || '').trim().slice(0, 5);
        if (!city || !/^[A-Z]{2}$/.test(state) || !/^\d{5}$/.test(zip)) continue;
        const name = cleanProviderName(row.display_name);
        if (!name) continue;

        const id = `${slug(state)}-${zip}-${slug(city)}-${category}`;
        let group = groups.get(id);
        if (!group) {
            group = { city, state, zip, category, clusters: new Map(), suggested: 0, typed: 0 };
            groups.set(id, group);
        }
        const key = canonicalProviderKey(name);
        const cluster = group.clusters.get(key) || { count: 0, spellings: new Map() };
        cluster.count++;
        cluster.spellings.set(name, (cluster.spellings.get(name) || 0) + 1);
        group.clusters.set(key, cluster);
        if (row.entry_mode === 'suggested_confirmed') group.suggested++;
        else group.typed++;
    }

    const cases: EvalCase[] = [];
    for (const [id, group] of groups) {
        const accepted = Array.from(group.clusters.values())
            .sort((a, b) => b.count - a.count)
            .map((cluster) => Array.from(cluster.spellings.entries())
                .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]);
        cases.push({
            id,
            kind: 'silver',
            city: group.city,
            state: group.state,
            zip: group.zip,
            category: group.category,
            accepted,
            confirmations: group.suggested + group.typed,
            origin: group.typed === 0 ? 'suggested' : group.suggested === 0 ? 'typed' : 'mixed',
        });
    }
    return cases.sort((a, b) => a.id.localeCompare(b.id));
}

export function parseCases(payload: unknown, kind: CaseKind): EvalCase[] {
    if (!Array.isArray(payload)) throw new Error('A case file must hold a JSON array.');
    return payload.map((raw, index) => {
        const item = (raw || {}) as Record<string, unknown>;
        const text = (key: string) => (typeof item[key] === 'string' ? (item[key] as string).trim() : '');
        const category = text('category') as UtilityCategory;
        const accepted = Array.isArray(item.accepted)
            ? item.accepted.filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
            : [];
        const state = text('state').toUpperCase();
        const problem = !text('city') ? 'city'
            : !/^[A-Z]{2}$/.test(state) ? 'state'
                : !/^\d{5}$/.test(text('zip')) ? 'zip'
                    : !EVAL_CATEGORIES.includes(category) ? 'category'
                        : accepted.length === 0 ? 'accepted' : null;
        if (problem) throw new Error(`Case ${index + 1}: missing or invalid "${problem}".`);
        const origin = text('origin');
        return {
            id: text('id') || `${slug(state)}-${text('zip')}-${slug(text('city'))}-${category}`,
            kind,
            city: text('city'),
            state,
            zip: text('zip'),
            category,
            accepted,
            confirmations: typeof item.confirmations === 'number' ? item.confirmations : undefined,
            origin: origin === 'suggested' || origin === 'typed' || origin === 'mixed' ? origin : undefined,
            note: text('note') || undefined,
            verified: typeof item.verified === 'boolean' ? item.verified : undefined,
            website_domain: text('website_domain') || undefined,
            phone: text('phone') || undefined,
            county: text('county') || undefined,
            municipality: text('municipality') || undefined,
        };
    });
}

function seededOrder(id: string, seed: string): number {
    let hash = 2166136261;
    for (const char of `${seed}:${id}`) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

/**
 * Pick up to `limit` cases, the same ones for the same seed: categories take
 * turns, and a locality is not used twice while unused localities remain.
 */
export function selectCases(cases: EvalCase[], limit: number, seed = 'eval'): EvalCase[] {
    if (limit >= cases.length) return [...cases];
    const queues = new Map<UtilityCategory, EvalCase[]>();
    for (const category of EVAL_CATEGORIES) {
        queues.set(category, cases
            .filter((item) => item.category === category)
            .sort((a, b) => seededOrder(a.id, seed) - seededOrder(b.id, seed) || a.id.localeCompare(b.id)));
    }
    const locality = (item: EvalCase) => `${item.state}:${item.zip}:${item.city.toLowerCase()}`;
    const usedLocalities = new Set<string>();
    const picked: EvalCase[] = [];

    while (picked.length < limit) {
        let progressed = false;
        for (const category of EVAL_CATEGORIES) {
            if (picked.length >= limit) break;
            const queue = queues.get(category)!;
            if (queue.length === 0) continue;
            const fresh = queue.findIndex((item) => !usedLocalities.has(locality(item)));
            const [next] = queue.splice(fresh === -1 ? 0 : fresh, 1);
            usedLocalities.add(locality(next));
            picked.push(next);
            progressed = true;
        }
        if (!progressed) break;
    }
    return picked;
}

/**
 * The address handed to the pipeline. The street is a fixed placeholder so the
 * parser reports the confidence a real address gets; prompts only ever carry
 * the city, state and ZIP.
 */
export function caseAddress(item: Pick<EvalCase, 'city' | 'state' | 'zip'>): string {
    return `100 Main St, ${item.city}, ${item.state} ${item.zip}`;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

export type MatchKind = 'exact' | 'partial' | null;

// Words that describe a kind of provider without naming one.
const GENERIC_TOKENS = new Set([
    'city', 'town', 'township', 'twp', 'borough', 'boro', 'village', 'county', 'municipal', 'municipality',
    'authority', 'department', 'dept', 'district', 'division', 'board', 'commission', 'public', 'works',
    'utility', 'utilities', 'service', 'services', 'system', 'systems', 'company', 'cooperative', 'coop',
    'co', 'op', 'inc', 'llc', 'corporation', 'corp', 'group',
    'electric', 'electricity', 'energy', 'power', 'light', 'gas', 'natural', 'water', 'sewer', 'sewage',
    'wastewater', 'waste', 'trash', 'sanitation', 'refuse', 'disposal', 'hauling', 'recycling', 'garbage',
    'propane', 'oil', 'fuel', 'fuels', 'heating', 'internet', 'cable', 'communications', 'broadband', 'fiber',
    'tv', 'of', 'the', 'and',
]);

/**
 * The product's canonical key, after dropping accents and apostrophe-like
 * marks so "Kauaʻi" and "Kauai", "Heller's" and "Hellers" are one name.
 */
function nameKey(name: string): string {
    return canonicalProviderKey(
        name.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’‘ʻʼ`]/g, '')
    );
}

function distinctiveTokens(name: string): string[] {
    return nameKey(name).split(' ').filter((token) => token && !GENERIC_TOKENS.has(token));
}

/**
 * 'exact' when the product's canonical key is the same. 'partial' when the
 * identifying words of one name are all in the other ("PPL Electric" and "PPL
 * Electric Utilities", "Hampden Township" and "Hampden Township Sewer
 * Authority"). Partial is a proxy: two different providers that share their
 * only identifying word also match.
 */
export function matchProviderName(returned: string, accepted: string[]): MatchKind {
    const key = nameKey(returned);
    if (!key) return null;
    if (accepted.some((name) => nameKey(name) === key)) return 'exact';

    const tokens = distinctiveTokens(returned);
    if (tokens.length === 0) return null;
    for (const name of accepted) {
        const other = distinctiveTokens(name);
        if (other.length === 0) continue;
        const [small, large] = tokens.length <= other.length ? [tokens, other] : [other, tokens];
        if (small.every((token) => large.includes(token))) return 'partial';
    }
    return null;
}

export function websiteDomain(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
        const host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase();
        return host.replace(/^www\./, '') || null;
    } catch {
        return null;
    }
}

function domainsMatch(found: string | null, expected: string): boolean {
    const want = websiteDomain(expected);
    if (!found || !want) return false;
    return found === want || found.endsWith(`.${want}`) || want.endsWith(`.${found}`);
}

function phoneDigits(value: string | null | undefined): string {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface EvalUsage {
    promptTokens: number | null;
    outputTokens: number | null;
    thinkingTokens: number | null;
    toolPromptTokens: number | null;
    searchQueryCount: number | null;
    sourceCount: number | null;
}

/** What one pipeline run returned for a case. */
export interface CaseRun {
    suggestions: Array<{
        display_name: string;
        confidence?: number;
        contact_phone?: string | null;
        contact_website?: string | null;
    }>;
    source: string;
    upstreamReasonCode: string | null;
    errorKind: string | null;
    attemptCount: number;
    latencyMs: number;
    usage: EvalUsage | null;
}

export interface CaseScore {
    case_id: string;
    kind: CaseKind;
    origin: CaseOrigin | '';
    category: UtilityCategory;
    state: string;
    zip: string;
    city: string;
    /** 'ai' when the model's answer was served, 'fallback' for the generic list. */
    served: 'ai' | 'fallback';
    source: string;
    upstream_reason: string;
    error_kind: string;
    passes: number;
    latency_ms: number;
    returned_count: number;
    top1: MatchKind;
    top3: MatchKind;
    /** 1-based rank of the first accepted name, or null. */
    first_match_rank: number | null;
    /** Returned names that are not an accepted answer. */
    extra_count: number;
    /** Extra names in a run that reported no web source at all. */
    unsourced_extra_count: number;
    /** null when the case has no known value or no accepted name was returned. */
    website_match: boolean | null;
    phone_match: boolean | null;
    prompt_tokens: number | null;
    output_tokens: number | null;
    thinking_tokens: number | null;
    tool_prompt_tokens: number | null;
    search_queries: number | null;
    sources: number | null;
    token_cost_usd: number | null;
    accepted_names: string;
    returned_names: string;
}

export interface ModelPrice {
    /** USD per 1M input tokens. */
    input: number;
    /** USD per 1M output tokens, thinking included. */
    output: number;
}

/** Standard-tier list prices read on 2026-10-12 (audit report, section 4.2). */
export const MODEL_PRICES: Record<string, ModelPrice> = {
    'gemini-3.1-flash-lite': { input: 0.25, output: 1.5 },
    'gemini-3.5-flash-lite': { input: 0.3, output: 2.5 },
    'gemini-3.6-flash': { input: 0.75, output: 3.75 },
    'gemini-3.8-flash': { input: 0.75, output: 3.75 },
    'gemini-3.1-pro-preview': { input: 2, output: 12 },
};

/** List price of one Google Search query beyond the free monthly allowance. */
export const SEARCH_QUERY_PRICE_USD = 14 / 1000;

/**
 * Token cost of a run at list price, or null when the model has no known price
 * or reported no usage. Tokens of search results fed back to the model
 * (`toolPromptTokens`) are left out: Google's pages do not say they are billed.
 */
export function tokenCostUsd(usage: EvalUsage | null, model: string): number | null {
    const price = MODEL_PRICES[model];
    if (!price || !usage || (usage.promptTokens === null && usage.outputTokens === null)) return null;
    const input = usage.promptTokens ?? 0;
    const output = (usage.outputTokens ?? 0) + (usage.thinkingTokens ?? 0);
    return (input * price.input + output * price.output) / 1_000_000;
}

export function scoreCase(item: EvalCase, run: CaseRun, model: string): CaseScore {
    const matches = run.suggestions.map((suggestion) => matchProviderName(suggestion.display_name, item.accepted));
    const firstIndex = matches.findIndex((match) => match !== null);
    const top3Index = matches.slice(0, 3).findIndex((match) => match !== null);
    const extras = matches.filter((match) => match === null).length;
    const matched = firstIndex === -1 ? null : run.suggestions[firstIndex];

    return {
        case_id: item.id,
        kind: item.kind,
        origin: item.origin || '',
        category: item.category,
        state: item.state,
        zip: item.zip,
        city: item.city,
        served: run.source === 'fallback' ? 'fallback' : 'ai',
        source: run.source,
        upstream_reason: run.upstreamReasonCode || '',
        error_kind: run.errorKind || '',
        passes: run.attemptCount,
        latency_ms: run.latencyMs,
        returned_count: run.suggestions.length,
        top1: matches[0] ?? null,
        top3: top3Index === -1 ? null : matches[top3Index],
        first_match_rank: firstIndex === -1 ? null : firstIndex + 1,
        extra_count: extras,
        unsourced_extra_count: run.source !== 'fallback' && run.usage?.sourceCount === 0 ? extras : 0,
        website_match: item.website_domain && matched
            ? domainsMatch(websiteDomain(matched.contact_website), item.website_domain)
            : null,
        phone_match: item.phone && matched
            ? phoneDigits(matched.contact_phone) === phoneDigits(item.phone)
            : null,
        prompt_tokens: run.usage?.promptTokens ?? null,
        output_tokens: run.usage?.outputTokens ?? null,
        thinking_tokens: run.usage?.thinkingTokens ?? null,
        tool_prompt_tokens: run.usage?.toolPromptTokens ?? null,
        search_queries: run.usage?.searchQueryCount ?? null,
        sources: run.usage?.sourceCount ?? null,
        token_cost_usd: tokenCostUsd(run.usage, model),
        accepted_names: item.accepted.join(' | '),
        returned_names: run.suggestions.map((suggestion) => suggestion.display_name).join(' | '),
    };
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

/** Nearest-rank percentile; null for an empty list. */
export function percentile(values: number[], p: number): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
    return sorted[Math.min(sorted.length, rank) - 1];
}

function sumOrNull(values: Array<number | null>): number | null {
    const known = values.filter((value): value is number => value !== null);
    return known.length === 0 ? null : known.reduce((total, value) => total + value, 0);
}

export interface EvalSummary {
    cases: number;
    top1: number;
    top1_exact: number;
    top3: number;
    fallback: number;
    model_errors: number;
    parse_errors: number;
    passes: number;
    latency_p50_ms: number | null;
    latency_p95_ms: number | null;
    single_provider_cases: number;
    /** Extra names per single-provider case that the AI answered. */
    single_provider_extras_avg: number | null;
    unsourced_extras: number;
    website_checked: number;
    website_matched: number;
    phone_checked: number;
    phone_matched: number;
    prompt_tokens: number | null;
    output_tokens: number | null;
    thinking_tokens: number | null;
    tool_prompt_tokens: number | null;
    search_queries: number | null;
    sources: number | null;
    /** Cases whose run reported token counts; totals are a floor below `cases`. */
    cases_with_usage: number;
    token_cost_usd: number | null;
    /** Searches at list price, as if the free monthly allowance were used up. */
    search_cost_usd: number | null;
    /** Reported token + search estimate, available only with coverage for every case. */
    total_cost_usd: number | null;
    cases_with_search_metadata: number;
    /** Token and search cost divided by cases with an accepted name in the top 3. */
    cost_per_top3_usd: number | null;
}

export function summarize(scores: CaseScore[]): EvalSummary {
    const single = scores.filter((score) =>
        SINGLE_PROVIDER_CATEGORIES.includes(score.category) && score.served === 'ai');
    const websiteChecked = scores.filter((score) => score.website_match !== null);
    const phoneChecked = scores.filter((score) => score.phone_match !== null);
    const top3 = scores.filter((score) => score.top3 !== null).length;
    const tokenCost = sumOrNull(scores.map((score) => score.token_cost_usd));
    const searches = sumOrNull(scores.map((score) => score.search_queries));
    const searchCoverage = scores.filter(score => score.search_queries !== null).length;
    const searchCost = scores.length > 0 && searchCoverage === scores.length && searches !== null
        ? searches * SEARCH_QUERY_PRICE_USD : null;
    const completeTokens = scores.length > 0 && scores.every(score => score.token_cost_usd !== null
        && score.prompt_tokens !== null && score.output_tokens !== null && score.thinking_tokens !== null);
    const totalCost = completeTokens && tokenCost !== null && searchCost !== null ? tokenCost + searchCost : null;

    return {
        cases: scores.length,
        top1: scores.filter((score) => score.top1 !== null).length,
        top1_exact: scores.filter((score) => score.top1 === 'exact').length,
        top3,
        fallback: scores.filter((score) => score.served === 'fallback').length,
        model_errors: scores.filter((score) => score.error_kind !== '').length,
        parse_errors: scores.filter((score) => score.upstream_reason === 'ai_parse_error').length,
        passes: scores.reduce((total, score) => total + score.passes, 0),
        latency_p50_ms: percentile(scores.map((score) => score.latency_ms), 50),
        latency_p95_ms: percentile(scores.map((score) => score.latency_ms), 95),
        single_provider_cases: single.length,
        single_provider_extras_avg: single.length === 0
            ? null
            : single.reduce((total, score) => total + score.extra_count, 0) / single.length,
        unsourced_extras: scores.reduce((total, score) => total + score.unsourced_extra_count, 0),
        website_checked: websiteChecked.length,
        website_matched: websiteChecked.filter((score) => score.website_match).length,
        phone_checked: phoneChecked.length,
        phone_matched: phoneChecked.filter((score) => score.phone_match).length,
        prompt_tokens: sumOrNull(scores.map((score) => score.prompt_tokens)),
        output_tokens: sumOrNull(scores.map((score) => score.output_tokens)),
        thinking_tokens: sumOrNull(scores.map((score) => score.thinking_tokens)),
        tool_prompt_tokens: sumOrNull(scores.map((score) => score.tool_prompt_tokens)),
        search_queries: searches,
        sources: sumOrNull(scores.map((score) => score.sources)),
        cases_with_usage: scores.filter((score) => score.prompt_tokens !== null).length,
        token_cost_usd: tokenCost,
        search_cost_usd: searchCost,
        total_cost_usd: totalCost,
        cases_with_search_metadata: searchCoverage,
        cost_per_top3_usd: totalCost === null || top3 === 0 ? null : totalCost / top3,
    };
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface EvalConfig {
    label: string;
    model: string;
    thinking: string;
    /** 'two' runs the verify pass after the first answer; 'one' does not. */
    passes: 'one' | 'two';
    recovery: boolean;
    grounding: boolean;
    /** Whether a case's county and municipality went into the prompt. Absent in older result files. */
    locality?: boolean;
}

export interface EvalResultFile {
    config: EvalConfig;
    started_at: string;
    commit: string;
    summary: EvalSummary;
    rows: CaseScore[];
}

/** Model calls a run can make at most: first pass, verify, recovery. */
export function maxPassesPerCase(config: Pick<EvalConfig, 'passes' | 'recovery'>): number {
    return 1 + (config.passes === 'two' ? 1 : 0) + (config.recovery ? 1 : 0);
}

function csvCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(scores: CaseScore[]): string {
    if (scores.length === 0) return '';
    const columns = Object.keys(scores[0]) as Array<keyof CaseScore>;
    const lines = [columns.join(',')];
    for (const score of scores) {
        lines.push(columns.map((column) => csvCell(score[column])).join(','));
    }
    return `${lines.join('\r\n')}\r\n`;
}

function share(count: number, total: number): string {
    return total === 0 ? 'n/a' : `${count}/${total} (${Math.round((count / total) * 100)}%)`;
}

function seconds(ms: number | null): string {
    return ms === null ? 'n/a' : `${(ms / 1000).toFixed(1)} s`;
}

function usd(value: number | null, digits = 4): string {
    return value === null ? 'n/a' : `$${value.toFixed(digits)}`;
}

function count(value: number | null): string {
    return value === null ? 'not reported' : String(value);
}

/** One column per result file, one row per measure. */
export function renderComparison(results: Array<Pick<EvalResultFile, 'config' | 'summary'>>): string {
    const rows: Array<[string, (result: Pick<EvalResultFile, 'config' | 'summary'>) => string]> = [
        ['Model', (r) => r.config.model],
        ['Thinking', (r) => r.config.thinking],
        ['Passes', (r) => `${r.config.passes}${r.config.recovery ? ' + recovery' : ''}`],
        ['Search grounding', (r) => (r.config.grounding ? 'on' : 'off')],
        ['County and township', (r) => (r.config.locality ? 'on' : 'off')],
        ['Cases', (r) => String(r.summary.cases)],
        ['Correct top answer', (r) => share(r.summary.top1, r.summary.cases)],
        ['Correct top answer, exact name', (r) => share(r.summary.top1_exact, r.summary.cases)],
        ['Correct answer in top 3', (r) => share(r.summary.top3, r.summary.cases)],
        ['Ended on the generic list', (r) => share(r.summary.fallback, r.summary.cases)],
        ['Runs with model failure', (r) => String(r.summary.model_errors)],
        ['Unreadable answers', (r) => String(r.summary.parse_errors)],
        ['Extra names per one-provider case', (r) => r.summary.single_provider_extras_avg === null
            ? 'n/a'
            : `${r.summary.single_provider_extras_avg.toFixed(1)} (${r.summary.single_provider_cases} cases)`],
        ['Extra names with reported zero sources', (r) => String(r.summary.unsourced_extras)],
        ['Website matches', (r) => share(r.summary.website_matched, r.summary.website_checked)],
        ['Phone matches', (r) => share(r.summary.phone_matched, r.summary.phone_checked)],
        ['Latency p50', (r) => seconds(r.summary.latency_p50_ms)],
        ['Latency p95', (r) => seconds(r.summary.latency_p95_ms)],
        ['AI passes (transport retries excluded)', (r) => String(r.summary.passes)],
        ['Reported searches (partial totals)', (r) => count(r.summary.search_queries)],
        ['Reported sources (summed per pass)', (r) => count(r.summary.sources)],
        ['Prompt tokens', (r) => count(r.summary.prompt_tokens)],
        ['Output tokens', (r) => count(r.summary.output_tokens)],
        ['Thinking tokens', (r) => count(r.summary.thinking_tokens)],
        ['Search-result tokens', (r) => count(r.summary.tool_prompt_tokens)],
        ['Token-only lower-bound estimate', (r) => usd(r.summary.token_cost_usd)],
        ['Cases with search metadata', (r) => r.summary.cases_with_search_metadata == null ? 'unknown (legacy)' : share(r.summary.cases_with_search_metadata, r.summary.cases)],
        ['Reported total cost estimate', (r) => usd(r.summary.total_cost_usd ?? null)],
        ['Search cost at list price', (r) => usd(r.summary.cases_with_search_metadata === r.summary.cases ? r.summary.search_cost_usd : null, 2)],
        ['Cost per case with a top-3 answer', (r) => usd(r.summary.total_cost_usd == null ? null : r.summary.cost_per_top3_usd)],
    ];
    const header = `| Measure | ${results.map((r) => r.config.label).join(' | ')} |`;
    const divider = `|---|${results.map(() => '---').join('|')}|`;
    return [header, divider, ...rows.map(([name, read]) => `| ${name} | ${results.map(read).join(' | ')} |`)].join('\n');
}
