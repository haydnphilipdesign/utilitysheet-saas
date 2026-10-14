import { randomUUID } from 'crypto';
import { sql } from '@/lib/neon/db';
import { DatabaseUnavailableError } from '@/lib/neon/statements';
import { writeAuxiliary } from '@/lib/telemetry/auxiliary-write';
import { itemLineageSchema, originMetadataSchema, type ExposureContext, type ExposureSummary, type OriginMetadata, type DeliveryKind, type ItemLineage } from '@/lib/telemetry/ai-lineage';
import { normalizeSuggestionName, persistAiGeneration, type CreateAiSuggestionRunInput } from './ai-telemetry';
import type { ProviderEntryMode, UtilityCategory } from '@/types';

export type GenerationHandle = {
    input: CreateAiSuggestionRunInput; origin: OriginMetadata;
    runId: string | null; itemIds: string[];
    /** Owned exactly once; followers never replay generation persistence. */
    persistence?: Promise<{ runId: string | null; exposureId: string | null }>;
};

/** One budget per consumer, including shared persistence wait and its exposure. */
export async function exposeGeneration(handle: GenerationHandle, context: ExposureContext | undefined, delivery: DeliveryKind, startedAt: number): Promise<(ExposureSummary & { itemIds: string[] }) | undefined> {
    return writeAuxiliary('ai_run', async signal => {
        const id = randomUUID();
        const duration = () => Math.min(2_000_000_000, Math.max(0, Date.now() - startedAt));
        if (delivery !== 'cache' && !handle.persistence) {
            handle.persistence = persistAiGeneration(handle.input, signal, context ? {
                id, context, origin: handle.origin, durationMs: duration(),
            } : undefined);
            const result = await handle.persistence;
            signal.throwIfAborted();
            handle.runId = result.runId;
            return result.exposureId ? { exposure_id: result.exposureId, run_id: result.runId, itemIds: handle.itemIds } : undefined;
        }
        if (handle.persistence) {
            const result = await handle.persistence;
            signal.throwIfAborted(); // No follow-on query after this consumer's deadline.
            handle.runId = result.runId;
        }
        if (!context) return undefined;
        if (!sql) throw new DatabaseUnavailableError();
        const origin = originMetadataSchema.parse(handle.origin);
        const rows = await sql.query(`
            INSERT INTO ai_result_exposures (id,request_id,edit_version,mode,feature,category,run_id,delivery_kind,lookup_state,service_duration_ms,origin_metadata,served_item_ids)
            SELECT $1,r.id,$3,$4,$5,$6,g.id,$8,
                CASE WHEN g.id IS NULL THEN 'origin_unavailable' ELSE COALESCE(g.transport_summary->>'skipped','collected') END,
                $9,$10::jsonb,ARRAY(SELECT i.id FROM ai_suggestion_items i WHERE i.run_id=g.id AND i.id=ANY($11::uuid[]))
            FROM requests r LEFT JOIN ai_generation_runs g ON g.id=$7::uuid AND g.lineage_version=2
            WHERE r.id=$2 AND r.seller_edit_version=$3
            RETURNING id,run_id,served_item_ids
        `, [id,context.requestId,context.editVersion,context.mode,context.feature,context.category,
            handle.runId,delivery,duration(),JSON.stringify(origin),handle.itemIds], { fetchOptions: { signal } });
        signal.throwIfAborted();
        const row = rows[0] as { id: string; run_id: string | null; served_item_ids: string[] } | undefined;
        return row ? { exposure_id: row.id, run_id: row.run_id, itemIds: row.served_item_ids } : undefined;
    }, undefined);
}

export type AcceptedChoice = {
    category: UtilityCategory; entryMode: ProviderEntryMode;
    selectedName: string | null; canonicalId?: string | null; lineage?: ItemLineage;
};

/** Immutable, batched, auxiliary evidence. No name search and no item mutation. */
export function recordAcceptedChoices(requestId: string, editVersion: number, choices: AcceptedChoice[]): Promise<void> {
    return writeAuxiliary('ai_selection', async signal => {
        if (!sql) throw new DatabaseUnavailableError();
        if (!choices.length) return;
        const payload = choices.map(choice => {
            const parsed = itemLineageSchema.safeParse(choice.lineage);
            return { category: choice.category, entry_mode: choice.entryMode,
                normalized_name: normalizeSuggestionName(choice.selectedName), canonical_id: choice.canonicalId ?? null,
                exposure_id: parsed.success ? parsed.data.exposure_id : null,
                run_id: parsed.success ? parsed.data.run_id : null, item_id: parsed.success ? parsed.data.item_id : null };
        });
        await sql.query(`
            WITH incoming AS (
                SELECT * FROM jsonb_to_recordset($3::jsonb) AS c(category text,entry_mode text,normalized_name text,canonical_id text,exposure_id uuid,run_id uuid,item_id uuid)
            ), checked AS (
                SELECT c.*,e.id AS owned_exposure,g.id AS origin,i.id AS member,
                    CASE WHEN c.exposure_id IS NULL THEN 'missing'
                        WHEN c.entry_mode NOT IN ('suggested_confirmed','search_selected') OR e.id IS NULL THEN 'invalid'
                        WHEN e.edit_version<>$2 THEN 'stale'
                        WHEN e.run_id IS NULL OR g.id IS NULL THEN 'origin_unavailable'
                        WHEN g.id<>c.run_id OR i.id IS NULL OR i.normalized_name<>c.normalized_name
                            OR i.canonical_id IS DISTINCT FROM c.canonical_id THEN 'invalid'
                        ELSE 'linked' END AS outcome
                FROM incoming c
                LEFT JOIN ai_result_exposures e ON e.id=c.exposure_id AND e.request_id=$1
                    AND e.category=c.category AND e.feature IN ('provider_suggestions','provider_search')
                LEFT JOIN ai_generation_runs g ON g.id=e.run_id AND g.lineage_version=2
                    AND g.category=e.category AND g.feature=e.feature
                LEFT JOIN ai_suggestion_items i ON i.id=c.item_id AND i.run_id=g.id AND i.category=c.category
                    AND i.id=ANY(e.served_item_ids)
            )
            INSERT INTO ai_selection_observations (request_id,edit_version,category,entry_mode,exposure_id,run_id,item_id,linkage_outcome)
            SELECT $1,$2,c.category,c.entry_mode,
                CASE WHEN c.outcome='linked' THEN c.owned_exposure END,
                CASE WHEN c.outcome='linked' THEN c.origin END,
                CASE WHEN c.outcome='linked' THEN c.member END,c.outcome
            FROM checked c JOIN requests r ON r.id=$1 AND r.seller_edit_version=$2 AND r.status='submitted'
            ON CONFLICT (request_id,edit_version,category) DO NOTHING
        `, [requestId,editVersion,JSON.stringify(payload)], { fetchOptions: { signal } });
    }, undefined);
}

/** Records only reached contact skips, with finite reasons and no provider/contact copies. */
export function recordContactSkips(requestId: string, editVersion: number, skips: { category: UtilityCategory; reason: 'historical_contact' | 'submitted_contact' }[]): Promise<void> {
    if (!skips.length) return Promise.resolve();
    return writeAuxiliary('ai_run', async signal => {
        if (!sql) throw new DatabaseUnavailableError();
        const origin = originMetadataSchema.parse({ v: 1,lineageVersion: 2,source: 'skipped',status: 'success',reason: null,
            upstreamReason: null,listKind: 'no_list',model: null,promptVersion: 'not_called',requestFormat: 'not_called',
            thinkingLevel: null,producedAt: new Date().toISOString() });
        await sql.query(`INSERT INTO ai_result_exposures
            (request_id,edit_version,mode,feature,category,delivery_kind,lookup_state,service_duration_ms,origin_metadata)
            SELECT r.id,$2,CASE WHEN r.is_demo THEN 'test' ELSE 'live' END,'provider_contact',s.category,'fresh',s.reason,0,$4::jsonb
            FROM requests r CROSS JOIN jsonb_to_recordset($3::jsonb) AS s(category text,reason text)
            WHERE r.id=$1 AND r.seller_edit_version=$2`,[requestId,editVersion,JSON.stringify(skips),JSON.stringify(origin)], { fetchOptions: { signal } });
    }, undefined);
}
