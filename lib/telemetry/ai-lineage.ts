import { z } from 'zod';

export const AI_LINEAGE_VERSION = 2;
export const AI_PRICE_VERSION = '2026-10-12-standard-list-v1';
export const itemLineageSchema = z.object({
    exposure_id: z.string().uuid(), run_id: z.string().uuid(), item_id: z.string().uuid(),
}).strict();
export type ItemLineage = z.infer<typeof itemLineageSchema>;
export const exposureSummarySchema = z.object({
    exposure_id: z.string().uuid(), run_id: z.string().uuid().nullable(),
}).strict();
export type ExposureSummary = z.infer<typeof exposureSummarySchema>;
/** Advisory identifiers must never reject primary answers. */
export const optionalItemLineageSchema = z.preprocess(value => {
    const parsed = itemLineageSchema.safeParse(value);
    return parsed.success ? parsed.data : undefined;
}, itemLineageSchema.optional());

export const usageMetrics = ['promptTokens', 'outputTokens', 'thinkingTokens', 'toolPromptTokens', 'searchQueryCount', 'sourceCount'] as const;
export type UsageMetric = typeof usageMetrics[number];
export type ReportedUsage = Record<UsageMetric, number | null>;
const count = z.number().int().min(0).max(2_000_000_000);
export const transportSummarySchema = z.object({
    v: z.literal(1), priceVersion: z.literal(AI_PRICE_VERSION),
    groundingRequested: z.boolean(), truncated: z.boolean(),
    skipped: z.enum(['unconfigured', 'circuit_open', 'deadline', 'disabled']).nullable(),
    attempts: z.array(z.object({
        pass: z.number().int().min(0).max(2),
        role: z.enum(['primary', 'verify', 'recovery', 'search', 'contact']),
        index: z.number().int().min(1).max(3), elapsedMs: count,
        outcome: z.enum(['answered', 'failed']),
        failure: z.enum(['timeout', 'rate_limited', 'empty_response', 'api_error']).nullable(),
        usage: z.object({
            promptTokens: count.nullable(), outputTokens: count.nullable(), thinkingTokens: count.nullable(),
            toolPromptTokens: count.nullable(), searchQueryCount: count.nullable(), sourceCount: count.nullable(),
        }).strict().nullable(),
        candidates: z.number().int().min(0).max(100).nullable(),
        queryCandidates: z.number().int().min(0).max(100).nullable(),
        sourceCandidates: z.number().int().min(0).max(100).nullable(),
    }).strict()).max(9),
}).strict();
export type TransportSummary = z.infer<typeof transportSummarySchema>;
export type TransportAttempt = TransportSummary['attempts'][number];

export function emptyTransport(skipped: TransportSummary['skipped'] = null, groundingRequested = false): TransportSummary {
    return { v: 1, priceVersion: AI_PRICE_VERSION, groundingRequested, truncated: false, skipped, attempts: [] };
}

export function mergeTransport(summaries: TransportSummary[]): TransportSummary | null {
    if (!summaries.length) return null; // Legacy/mocked drivers have unknown coverage.
    const attempts = summaries.flatMap(summary => summary.attempts);
    return { ...summaries[0], skipped: summaries.find(summary => summary.skipped)?.skipped ?? null,
        groundingRequested: summaries.some(summary => summary.groundingRequested),
        attempts: attempts.slice(0, 9), truncated: attempts.length > 9 || summaries.some(summary => summary.truncated) };
}

export function transportCoverage(summary: TransportSummary) {
    return Object.fromEntries(usageMetrics.map(metric => {
        const reported = summary.attempts.filter(attempt => attempt.usage?.[metric] != null);
        const started = summary.attempts.length;
        return [metric, { started, reported: reported.length,
            sum: reported.length ? reported.reduce((sum, attempt) => sum + attempt.usage![metric]!, 0) : null,
            coverage: !started && !summary.truncated ? 'not_applicable' : !reported.length ? 'none'
                : !summary.truncated && reported.length === started ? 'complete' : 'partial' }];
    }));
}

export const originMetadataSchema = z.object({
    v: z.literal(1), source: z.enum(['ai_primary', 'ai_verify', 'ai_recovery', 'history_blend', 'fallback', 'disabled', 'skipped']),
    status: z.enum(['success', 'fallback', 'error', 'parse_error', 'quality_rejected']),
    reason: z.enum(['ai_unconfigured', 'ai_provider_error', 'ai_parse_error', 'ai_empty', 'quality_gate_failed', 'state_mismatch_rejected', 'fallback_used']).nullable(),
    upstreamReason: z.enum(['ai_unconfigured', 'ai_provider_error', 'ai_parse_error', 'ai_empty', 'quality_gate_failed', 'state_mismatch_rejected', 'fallback_used']).nullable(),
    listKind: z.enum(['ai', 'common', 'no_list']), model: z.string().max(120).nullable(),
    promptVersion: z.string().max(120), requestFormat: z.string().max(120), thinkingLevel: z.string().max(40).nullable(),
    producedAt: z.string().datetime(), lineageVersion: z.literal(2),
}).strict();
export type OriginMetadata = z.infer<typeof originMetadataSchema>;
export type DeliveryKind = 'fresh' | 'shared' | 'cache';
export type ExposureContext = {
    requestId: string; editVersion: number; mode: 'live' | 'test';
    feature: 'provider_suggestions' | 'provider_search' | 'provider_contact'; category: string | null;
};
