import { AI_PRICE_VERSION, type ReportedUsage } from './ai-lineage';

/** Existing standard-tier constants from the 2026-10-12 audit; no price refresh. */
export const MODEL_PRICES: Record<string, { input: number; output: number }> = {
    'gemini-3.1-flash-lite': { input: 0.25, output: 1.5 },
    'gemini-3.5-flash-lite': { input: 0.3, output: 2.5 },
    'gemini-3.6-flash': { input: 0.75, output: 3.75 },
    'gemini-3.8-flash': { input: 0.75, output: 3.75 },
    'gemini-3.1-pro-preview': { input: 2, output: 12 },
};
export const SEARCH_QUERY_PRICE_USD = 14 / 1000;

/** Reported token lower bound. Tool-result tokens have no assumed billing rule. */
export function tokenCostUsd(usage: ReportedUsage | null, model: string): number | null {
    const price = MODEL_PRICES[model];
    if (!price || !usage || (usage.promptTokens === null && usage.outputTokens === null)) return null;
    return ((usage.promptTokens ?? 0) * price.input +
        ((usage.outputTokens ?? 0) + (usage.thinkingTokens ?? 0)) * price.output) / 1_000_000;
}

export function reportedCostEstimate(usage: ReportedUsage, model: string | null, complete: boolean) {
    const tokens = tokenCostUsd(usage,model ?? '');
    const searches = complete && usage.searchQueryCount !== null ? usage.searchQueryCount * SEARCH_QUERY_PRICE_USD : null;
    return { priceVersion: AI_PRICE_VERSION, tokenLowerBoundUsd: tokens, reportedSearchEstimateUsd: searches,
        reportedTotalEstimateUsd: complete && tokens !== null && searches !== null ? tokens + searches : null };
}
