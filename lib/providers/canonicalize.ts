import type { ProviderSuggestion } from '@/types';

/**
 * Deterministic canonicalization and dedup for provider suggestions.
 *
 * AI passes sometimes return the same provider under two spellings
 * ("Pennsylvania American Water" vs "PA American Water", "PG&E" vs
 * "Pacific Gas & Electric"). Sellers should never see those as separate
 * choices, so every suggestion list is collapsed through a canonical key
 * before rendering. The rules here are intentionally conservative:
 * genuinely different providers (e.g. "Duke Energy" vs "Duke Energy
 * Progress") must keep distinct keys.
 */

// Two-letter state codes that are safe to expand inside a provider name.
// Codes that collide with common words or corporate abbreviations are
// excluded on purpose: CO (Company), IN, OR, ME, HI, OK, DE, LA, OH, ID,
// UT, AL, MT, NE, IA, WA.
const SAFE_STATE_EXPANSIONS: Record<string, string> = {
    ak: 'alaska',
    az: 'arizona',
    ar: 'arkansas',
    ca: 'california',
    ct: 'connecticut',
    fl: 'florida',
    ga: 'georgia',
    il: 'illinois',
    ks: 'kansas',
    ky: 'kentucky',
    ma: 'massachusetts',
    md: 'maryland',
    mi: 'michigan',
    mn: 'minnesota',
    mo: 'missouri',
    ms: 'mississippi',
    nc: 'north carolina',
    nd: 'north dakota',
    nh: 'new hampshire',
    nj: 'new jersey',
    nm: 'new mexico',
    nv: 'nevada',
    ny: 'new york',
    pa: 'pennsylvania',
    ri: 'rhode island',
    sc: 'south carolina',
    sd: 'south dakota',
    tn: 'tennessee',
    tx: 'texas',
    va: 'virginia',
    vt: 'vermont',
    wi: 'wisconsin',
    wv: 'west virginia',
    wy: 'wyoming',
};

// Corporate-form suffixes that never distinguish one provider from another.
const CORPORATE_SUFFIXES = new Set([
    'inc',
    'incorporated',
    'llc',
    'llp',
    'lp',
    'ltd',
    'co',
    'corp',
    'corporation',
    'company',
]);

// Connector words that don't carry identity ("Gas & Electric" === "Gas and Electric").
const STOP_TOKENS = new Set(['and', 'of', 'the']);

// Well-known brand aliases, keyed by the token-normalized form. Both sides of
// each pair resolve to the same canonical family so they dedupe together.
// Only include pairs where the two names are unambiguously the same provider.
const BRAND_ALIASES: Record<string, string> = {
    'pge': 'pacific gas electric',
    'pg e': 'pacific gas electric',
    'pacific gas electric': 'pacific gas electric',
    'fpl': 'florida power light',
    'florida power light': 'florida power light',
    'comed': 'commonwealth edison',
    'com ed': 'commonwealth edison',
    'commonwealth edison': 'commonwealth edison',
    'coned': 'consolidated edison',
    'con ed': 'consolidated edison',
    'con edison': 'consolidated edison',
    'consolidated edison': 'consolidated edison',
    'bge': 'baltimore gas electric',
    'baltimore gas electric': 'baltimore gas electric',
    'pseg': 'public service electric gas',
    'pse g': 'public service electric gas',
    'public service electric gas': 'public service electric gas',
    'sce': 'southern california edison',
    'southern california edison': 'southern california edison',
    'sdge': 'san diego gas electric',
    'sdg e': 'san diego gas electric',
    'san diego gas electric': 'san diego gas electric',
    'socalgas': 'southern california gas',
    'so cal gas': 'southern california gas',
    'southern california gas': 'southern california gas',
    'xfinity': 'xfinity comcast',
    'comcast': 'xfinity comcast',
    'xfinity comcast': 'xfinity comcast',
    'comcast xfinity': 'xfinity comcast',
    'wm': 'waste management',
    'waste management': 'waste management',
    'att': 'at t',
    'at t': 'at t',
};

function tokenize(name: string): string[] {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .split(' ')
        .filter(Boolean);
}

function stripParentheticals(name: string): string {
    return name.replace(/\([^)]*\)/g, ' ');
}

/** True if the raw display name still contains a bare state abbreviation. */
function containsStateAbbreviation(name: string): boolean {
    return tokenize(stripParentheticals(name)).some((token) => token in SAFE_STATE_EXPANSIONS);
}

/**
 * Canonical dedup key for a provider display name. Case, punctuation,
 * connector words, corporate suffixes, parentheticals, safe state
 * abbreviations, and well-known brand aliases all collapse.
 */
export function canonicalProviderKey(name: string): string {
    let tokens = tokenize(stripParentheticals(name));

    // Drop connector words.
    tokens = tokens.filter((token) => !STOP_TOKENS.has(token));

    // Strip trailing corporate suffixes (repeatedly, e.g. "... Co Inc"),
    // but never strip the whole name away.
    while (tokens.length > 1 && CORPORATE_SUFFIXES.has(tokens[tokens.length - 1])) {
        tokens = tokens.slice(0, -1);
    }

    // Expand safe state abbreviations ("PA American Water" -> "pennsylvania american water").
    tokens = tokens.flatMap((token) =>
        token in SAFE_STATE_EXPANSIONS ? SAFE_STATE_EXPANSIONS[token].split(' ') : [token]
    );

    const joined = tokens.join(' ');
    if (!joined) {
        return tokenize(name).join(' ');
    }

    // Alias lookup happens in natural word order; the final key is sorted so
    // reorderings ("American Water of Pennsylvania" vs "Pennsylvania American
    // Water") collapse to one key.
    const aliased = BRAND_ALIASES[joined] || joined;
    return aliased.split(' ').sort().join(' ');
}

/**
 * Pick the better display name when two suggestions collapse to one key.
 * Prefers the spelled-out canonical form over abbreviations, then higher
 * confidence, then the more descriptive (longer) name.
 */
function preferDisplay(a: ProviderSuggestion, b: ProviderSuggestion): ProviderSuggestion {
    const aAbbrev = containsStateAbbreviation(a.display_name);
    const bAbbrev = containsStateAbbreviation(b.display_name);
    if (aAbbrev !== bAbbrev) return aAbbrev ? b : a;

    const aConfidence = a.confidence ?? 0;
    const bConfidence = b.confidence ?? 0;
    if (aConfidence !== bConfidence) return aConfidence > bConfidence ? a : b;

    return b.display_name.length > a.display_name.length ? b : a;
}

function mergeSuggestions(existing: ProviderSuggestion, incoming: ProviderSuggestion): ProviderSuggestion {
    const keeper = preferDisplay(existing, incoming);
    const other = keeper === existing ? incoming : existing;

    return {
        ...keeper,
        confidence: Math.max(existing.confidence ?? 0, incoming.confidence ?? 0),
        rationale_short: keeper.rationale_short || other.rationale_short,
        contact_phone: keeper.contact_phone || other.contact_phone,
        contact_website: keeper.contact_website || other.contact_website,
        canonical_id: keeper.canonical_id || other.canonical_id,
    };
}

/**
 * Collapse near-duplicate provider suggestions while preserving order of
 * first appearance. Distinct providers are never merged; duplicates keep the
 * best display name, the highest confidence, and any contact info either
 * variant carried.
 */
export function dedupeProviderSuggestions(suggestions: ProviderSuggestion[]): ProviderSuggestion[] {
    const byKey = new Map<string, ProviderSuggestion>();

    for (const suggestion of suggestions) {
        const displayName = String(suggestion.display_name || '').trim();
        if (!displayName) continue;

        const key = canonicalProviderKey(displayName);
        if (!key) continue;

        const existing = byKey.get(key);
        byKey.set(key, existing ? mergeSuggestions(existing, suggestion) : suggestion);
    }

    return Array.from(byKey.values());
}
