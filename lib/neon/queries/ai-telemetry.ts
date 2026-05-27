import { sql } from '@/lib/neon/db';
import type { ProviderEntryMode, ProviderSuggestion, UtilityCategory } from '@/types';

export type AiTelemetryFeature = 'provider_suggestions' | 'provider_search';
export type AiTelemetryStatus = 'success' | 'fallback' | 'error' | 'parse_error' | 'quality_rejected';

export interface CreateAiSuggestionRunInput {
    requestId?: string;
    accountId?: string;
    organizationId?: string | null;
    feature: AiTelemetryFeature;
    category: UtilityCategory;
    provider: string;
    model: string | null;
    promptVersion: string;
    servedPipeline: string | null;
    source: string | null;
    status: AiTelemetryStatus;
    reasonCode: string | null;
    upstreamReasonCode: string | null;
    latencyMs: number;
    attemptCount: number;
    localityState: string | null;
    localityZip3: string | null;
    localityCity: string | null;
    suggestionCount: number;
    cacheHit?: boolean;
    suggestions: ProviderSuggestion[];
}

export interface MarkAiSuggestionSelectionInput {
    requestId: string;
    category: UtilityCategory;
    selectedName: string | null;
    finalEntryMode: ProviderEntryMode;
    canonicalId?: string | null;
    confidenceScore?: number | null;
}

export function normalizeSuggestionName(input: string | null | undefined): string {
    return String(input || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function clampConfidence(value: unknown): number | null {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.max(0, Math.min(1, numeric));
}

function toStatus(input: CreateAiSuggestionRunInput): AiTelemetryStatus {
    if (input.status !== 'success') return input.status;
    if (input.reasonCode === 'fallback_used' || input.source === 'fallback') return 'fallback';
    if (input.upstreamReasonCode === 'ai_parse_error') return 'parse_error';
    if (input.upstreamReasonCode === 'ai_provider_error' || input.upstreamReasonCode === 'ai_unconfigured') return 'error';
    if (
        input.upstreamReasonCode === 'quality_gate_failed' ||
        input.upstreamReasonCode === 'state_mismatch_rejected' ||
        input.reasonCode === 'quality_gate_failed' ||
        input.reasonCode === 'state_mismatch_rejected'
    ) {
        return 'quality_rejected';
    }
    return 'success';
}

export async function createAiSuggestionRun(input: CreateAiSuggestionRunInput): Promise<string | null> {
    if (!sql) return null;

    const status = toStatus(input);
    const runRows = await sql`
        INSERT INTO ai_generation_runs (
            request_id,
            account_id,
            organization_id,
            feature,
            category,
            provider,
            model,
            prompt_version,
            served_pipeline,
            source,
            status,
            reason_code,
            upstream_reason_code,
            latency_ms,
            attempt_count,
            locality_state,
            locality_zip3,
            locality_city,
            suggestion_count,
            cache_hit
        ) VALUES (
            ${input.requestId || null},
            ${input.accountId || null},
            ${input.organizationId || null},
            ${input.feature},
            ${input.category},
            ${input.provider},
            ${input.model},
            ${input.promptVersion},
            ${input.servedPipeline},
            ${input.source},
            ${status},
            ${input.reasonCode},
            ${input.upstreamReasonCode},
            ${input.latencyMs},
            ${input.attemptCount},
            ${input.localityState},
            ${input.localityZip3},
            ${input.localityCity},
            ${input.suggestionCount},
            ${Boolean(input.cacheHit)}
        )
        RETURNING id
    `;

    const runId = (runRows[0] as { id?: string } | undefined)?.id || null;
    if (!runId || input.suggestions.length === 0) {
        return runId;
    }

    const itemRows = input.suggestions.map((suggestion, index) => ({
        rank: index + 1,
        display_name: String(suggestion.display_name || '').trim(),
        normalized_name: normalizeSuggestionName(suggestion.display_name),
        canonical_id: suggestion.canonical_id || null,
        confidence: clampConfidence(suggestion.confidence),
        source: input.source,
        contact_present: Boolean(suggestion.contact_phone || suggestion.contact_website),
    })).filter((item) => item.display_name && item.normalized_name);

    if (itemRows.length === 0) {
        return runId;
    }

    await sql`
        INSERT INTO ai_suggestion_items (
            run_id,
            request_id,
            category,
            rank,
            display_name,
            normalized_name,
            canonical_id,
            confidence,
            source,
            contact_present
        )
        SELECT
            ${runId}::uuid,
            ${input.requestId || null}::uuid,
            ${input.category},
            items.rank,
            items.display_name,
            items.normalized_name,
            items.canonical_id,
            items.confidence,
            items.source,
            items.contact_present
        FROM jsonb_to_recordset(${JSON.stringify(itemRows)}::jsonb) AS items(
            rank int,
            display_name text,
            normalized_name text,
            canonical_id text,
            confidence numeric,
            source text,
            contact_present boolean
        )
    `;

    return runId;
}

export async function markAiSuggestionSelection(input: MarkAiSuggestionSelectionInput): Promise<void> {
    if (!sql) return;

    const normalizedName = normalizeSuggestionName(input.selectedName);
    if (!normalizedName) return;

    await sql`
        UPDATE ai_suggestion_items
        SET
            selected_by_seller = TRUE,
            final_entry_mode = ${input.finalEntryMode},
            final_provider_name = ${input.selectedName},
            final_canonical_id = ${input.canonicalId || null},
            final_confidence_score = ${clampConfidence(input.confidenceScore)},
            selected_at = NOW()
        WHERE id = (
            SELECT id
            FROM ai_suggestion_items
            WHERE request_id = ${input.requestId}
              AND category = ${input.category}
              AND normalized_name = ${normalizedName}
            ORDER BY created_at DESC, rank ASC
            LIMIT 1
        )
    `;
}
