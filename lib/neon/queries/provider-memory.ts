/**
 * Provider memory query helpers.
 * Uses existing utility_entries + requests tables for org-scoped locality ranking.
 */
import { sql } from '@/lib/neon/db';
import type { UtilityCategory } from '@/types';

export interface ProviderMemoryCandidate {
    display_name: string;
    normalized_name: string;
    occurrences: number;
    avg_confidence: number;
    locality_score: number;
}

export async function getProviderMemoryCandidates(params: {
    accountId: string;
    organizationId: string | null;
    category: UtilityCategory;
    state: string;
    zipPrefix?: string | null;
    city?: string | null;
    excludeRequestId?: string;
    limit?: number;
}): Promise<ProviderMemoryCandidate[]> {
    if (!sql) return [];

    const state = params.state.trim().toUpperCase();
    if (!state) return [];

    const city = (params.city || '').trim().toLowerCase();
    const zipPrefix = (params.zipPrefix || '').trim();
    const limit = Math.max(1, Math.min(25, params.limit || 10));

    const rows = await sql`
        SELECT
            TRIM(COALESCE(NULLIF(ue.display_name, ''), NULLIF(ue.raw_text, ''))) AS display_name,
            LOWER(
                REGEXP_REPLACE(
                    TRIM(COALESCE(ue.display_name, ue.raw_text, '')),
                    '[[:space:]]+',
                    ' ',
                    'g'
                )
            ) AS normalized_name,
            COUNT(*)::int AS occurrences,
            COALESCE(AVG(COALESCE(ue.confidence_score, 0.5)), 0.5)::float AS avg_confidence,
            MAX(
                CASE
                    WHEN ${zipPrefix} <> ''
                        AND COALESCE(r.property_address_structured->>'zip', '') LIKE (${zipPrefix} || '%')
                    THEN 3
                    WHEN ${city} <> ''
                        AND LOWER(COALESCE(r.property_address_structured->>'city', '')) = ${city}
                    THEN 2
                    ELSE 1
                END
            )::int AS locality_score
        FROM utility_entries ue
        INNER JOIN requests r ON r.id = ue.request_id
        WHERE r.account_id = ${params.accountId}
        AND r.organization_id IS NOT DISTINCT FROM ${params.organizationId}
        AND ue.category = ${params.category}
        AND (
            UPPER(COALESCE(r.property_address_structured->>'state', '')) = ${state}
            OR r.property_address ILIKE ${`% ${state} %`}
            OR r.property_address ILIKE ${`%, ${state} %`}
        )
        AND (
            ${params.excludeRequestId || null}::uuid IS NULL
            OR ue.request_id <> ${params.excludeRequestId || null}::uuid
        )
        AND NULLIF(TRIM(COALESCE(ue.display_name, ue.raw_text, '')), '') IS NOT NULL
        GROUP BY 1, 2
        ORDER BY locality_score DESC, occurrences DESC, avg_confidence DESC
        LIMIT ${limit}
    `;

    return (rows as Array<{
        display_name: string | null;
        normalized_name: string | null;
        occurrences: number | string;
        avg_confidence: number | string;
        locality_score: number | string;
    }>)
        .map((row) => ({
            display_name: String(row.display_name || '').trim(),
            normalized_name: String(row.normalized_name || '').trim(),
            occurrences: Number(row.occurrences || 0),
            avg_confidence: Number(row.avg_confidence || 0),
            locality_score: Number(row.locality_score || 0),
        }))
        .filter((row) => row.display_name.length > 0 && row.normalized_name.length > 0);
}
