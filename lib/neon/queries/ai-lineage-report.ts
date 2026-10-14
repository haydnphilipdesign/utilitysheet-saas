import { reportedCostEstimate } from '@/lib/telemetry/ai-cost';
import { usageMetrics, type ReportedUsage } from '@/lib/telemetry/ai-lineage';
import 'server-only';
import { sql } from '@/lib/neon/db';
import { isMissingRelationError } from '@/lib/neon/statements';

export type AiLineageCohort = {
    feature: string; category: string | null; source: string; listKind: string;
    model: string | null; prompt: string; delivery: string; lookupState: string; serviceP50Ms: number | null; serviceP95Ms: number | null; cohort: 'first' | 'reopen';
    exposures: number; origins: number; unknownOrigins: number; reportedExposures: number;
    reportedItems: number; linkedChoices: number; linkedWithAck: number; linkedWithoutAck: number; currentChoiceDiffers: number; laterEdits: number;
};
export type AiLineageReport = {
    state: 'available' | 'not_installed' | 'unavailable'; cohorts: AiLineageCohort[];
    choices: { cohort: string; outcome: string; count: number }[];
    generations: { feature: string; source: string; model: string | null; prompt: string; listKind: string; count: number; attempts: number; recovered: number; incomplete: number; usage: Record<string,{ sum: number | null; started: number; reported: number; completeRuns: number }>; estimate: ReturnType<typeof reportedCostEstimate> }[];
};

/** Internal aggregate reader. The caller must authorize with requireAdmin first. */
export async function readAiLineageReport(days: 7 | 30 | 90): Promise<AiLineageReport> {
    const empty = { cohorts: [], choices: [], generations: [] };
    if (!sql) return { state: 'unavailable', ...empty };
    try {
        const rows = await sql.query(`
            WITH live AS (
                SELECT r.id FROM requests r JOIN accounts a ON a.id=r.account_id AND a.role='user'
                WHERE r.deleted_at IS NULL AND COALESCE(r.is_demo,FALSE)=FALSE
            ), exposures AS (
                SELECT x.*,g.id AS retained_origin FROM ai_result_exposures x JOIN live r ON r.id=x.request_id
                LEFT JOIN ai_generation_runs g ON g.id=x.run_id AND g.lineage_version=2
                WHERE x.created_at>=NOW()-make_interval(days=>$1::int)
            ), acknowledged AS (
                SELECT DISTINCT x.id AS exposure_id FROM exposures x JOIN event_logs e ON e.request_id=x.request_id
                WHERE e.event_type='seller_suggestions_rendered' AND e.event_data->>'v'='2'
                    AND e.event_data->>'exposure_id'=x.id::text AND e.event_data->>'category'=x.category
                    AND e.event_data->>'edit_version'=x.edit_version::text
                    AND e.created_at>=NOW()-make_interval(days=>$1::int)
            ), acknowledged_items AS (
                SELECT DISTINCT x.id AS exposure_id,i.id AS item_id FROM exposures x
                JOIN event_logs e ON e.request_id=x.request_id AND e.event_type='seller_suggestions_rendered'
                    AND e.event_data->>'v'='2' AND e.event_data->>'exposure_id'=x.id::text
                    AND e.event_data->>'category'=x.category AND e.event_data->>'edit_version'=x.edit_version::text
                    AND e.created_at>=NOW()-make_interval(days=>$1::int)
                CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(e.event_data->'rendered_item_ids')='array'
                    THEN e.event_data->'rendered_item_ids' ELSE '[]'::jsonb END) AS reported(id)
                JOIN ai_suggestion_items i ON i.id::text=reported.id AND i.id=ANY(x.served_item_ids)
                    AND i.run_id=x.retained_origin AND i.category=x.category
            ), choices AS (
                SELECT c.*,CASE WHEN c.linkage_outcome='linked' AND (c.item_id IS NULL OR c.run_id IS NULL OR c.exposure_id IS NULL)
                    THEN 'origin_unavailable' ELSE c.linkage_outcome END AS retained_outcome
                FROM ai_selection_observations c JOIN live r ON r.id=c.request_id
                WHERE c.created_at>=NOW()-make_interval(days=>$1::int)
            ), cohort AS (
                SELECT x.feature,x.category,x.origin_metadata->>'source' AS source,x.origin_metadata->>'listKind' AS list_kind,
                    x.origin_metadata->>'model' AS model,x.origin_metadata->>'promptVersion' AS prompt,x.delivery_kind AS delivery,x.lookup_state,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY x.service_duration_ms) AS service_p50_ms,
                    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY x.service_duration_ms) AS service_p95_ms,
                    CASE WHEN x.edit_version=0 THEN 'first' ELSE 'reopen' END AS cohort,
                    COUNT(DISTINCT x.id)::int AS exposures,COUNT(DISTINCT x.retained_origin)::int AS origins,
                    COUNT(DISTINCT x.id) FILTER (WHERE x.retained_origin IS NULL)::int AS unknown_origins,
                    COUNT(DISTINCT a.exposure_id)::int AS reported_exposures,
                    (SELECT COUNT(*)::int FROM acknowledged_items ai WHERE ai.exposure_id=ANY(ARRAY_AGG(DISTINCT x.id))) AS reported_items,
                    COUNT(DISTINCT c.id) FILTER (WHERE c.retained_outcome='linked')::int AS linked_choices,
                    COUNT(DISTINCT c.id) FILTER (WHERE c.retained_outcome='linked' AND EXISTS (
                        SELECT 1 FROM utility_entries u JOIN ai_suggestion_items original ON original.id=c.item_id
                        WHERE u.request_id=c.request_id AND u.category=c.category AND
                            (TRIM(REGEXP_REPLACE(LOWER(COALESCE(u.display_name,u.raw_text,'')),'[^a-z0-9]+',' ','g'))<>original.normalized_name
                             OR u.canonical_id IS DISTINCT FROM original.canonical_id)))::int AS current_choice_differs,
                    COUNT(DISTINCT c.id) FILTER (WHERE c.retained_outcome='linked' AND EXISTS (
                        SELECT 1 FROM event_logs edited WHERE edited.request_id=c.request_id
                            AND edited.event_type='submitted_sheet_edited' AND edited.created_at>c.created_at))::int AS later_edits,
                    COUNT(DISTINCT c.id) FILTER (WHERE c.retained_outcome='linked' AND EXISTS (
                        SELECT 1 FROM acknowledged_items ai WHERE ai.exposure_id=c.exposure_id AND ai.item_id=c.item_id))::int AS linked_with_ack
                FROM exposures x LEFT JOIN acknowledged a ON a.exposure_id=x.id
                LEFT JOIN choices c ON c.exposure_id=x.id AND c.request_id=x.request_id AND c.edit_version=x.edit_version AND c.category=x.category
                GROUP BY x.feature,x.category,x.origin_metadata->>'source',x.origin_metadata->>'listKind',x.origin_metadata->>'model',
                    x.origin_metadata->>'promptVersion',x.delivery_kind,x.lookup_state,CASE WHEN x.edit_version=0 THEN 'first' ELSE 'reopen' END
            ), outcome AS (
                SELECT CASE WHEN edit_version=0 THEN 'first' ELSE 'reopen' END AS cohort,retained_outcome AS outcome,COUNT(*)::int AS count
                FROM choices GROUP BY CASE WHEN edit_version=0 THEN 'first' ELSE 'reopen' END,retained_outcome
            ), generation AS (
                SELECT g.feature,COALESCE(g.source,'unknown') AS source,g.model,g.prompt_version AS prompt,
                    CASE WHEN g.suggestion_count=0 THEN 'no_list' WHEN g.source='fallback' THEN 'common' ELSE 'ai' END AS list_kind,
                    COUNT(*)::int AS count,COALESCE(SUM(g.transport_attempt_count),0)::int AS attempts,
                    SUM(g.prompt_tokens) AS prompt_tokens,SUM(g.output_tokens) AS output_tokens,SUM(g.thinking_tokens) AS thinking_tokens,
                    SUM(g.tool_prompt_tokens) AS tool_prompt_tokens,SUM(g.search_query_count) AS search_query_count,SUM(g.source_count) AS source_count,
                    ${usageMetrics.map(metric => `jsonb_build_object('sum',SUM((g.usage_coverage->'${metric}'->>'sum')::bigint),
                        'started',COALESCE(SUM((g.usage_coverage->'${metric}'->>'started')::int),0),
                        'reported',COALESCE(SUM((g.usage_coverage->'${metric}'->>'reported')::int),0),
                        'completeRuns',COUNT(*) FILTER (WHERE g.usage_coverage->'${metric}'->>'coverage'='complete')) AS "${metric}"`).join(',')},
                    COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(g.transport_summary->'attempts','[]'::jsonb)) success
                        WHERE success->>'outcome'='answered' AND success->>'failure' IS NULL) AND EXISTS (
                        SELECT 1 FROM jsonb_array_elements(COALESCE(g.transport_summary->'attempts','[]'::jsonb)) t
                        WHERE t->>'failure' IS NOT NULL))::int AS recovered,
                    COUNT(*) FILTER (WHERE g.transport_summary IS NULL OR g.summary_truncated=TRUE OR EXISTS (
                        SELECT 1 FROM jsonb_each(COALESCE(g.usage_coverage,'{}'::jsonb)) m
                        WHERE m.value->>'coverage' IN ('none','partial')))::int AS incomplete
                FROM ai_generation_runs g WHERE g.lineage_version=2 AND g.source IS DISTINCT FROM 'disabled'
                    AND g.created_at>=NOW()-make_interval(days=>$1::int)
                GROUP BY g.feature,g.source,g.model,g.prompt_version,g.suggestion_count=0
            ) SELECT
                (SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY feature,category,cohort,delivery),'[]'::jsonb) FROM cohort c) AS cohorts,
                (SELECT COALESCE(jsonb_agg(to_jsonb(o) ORDER BY cohort,outcome),'[]'::jsonb) FROM outcome o) AS choices,
                (SELECT COALESCE(jsonb_agg(to_jsonb(g) ORDER BY feature,model,prompt,source),'[]'::jsonb) FROM generation g) AS generations
        `, [days]);
        const row = rows[0] as Record<string, unknown> | undefined;
        const cohorts = (Array.isArray(row?.cohorts) ? row.cohorts : []) as Record<string, unknown>[];
        const generations = (Array.isArray(row?.generations) ? row.generations : []) as Record<string, unknown>[];
        return { state: 'available',
            cohorts: cohorts.map(c => ({ feature: String(c.feature), category: c.category == null ? null : String(c.category),
                source: String(c.source), listKind: String(c.list_kind), model: c.model == null ? null : String(c.model),
                prompt: String(c.prompt), delivery: String(c.delivery), lookupState: String(c.lookup_state),
                serviceP50Ms: c.service_p50_ms==null ? null : Number(c.service_p50_ms),serviceP95Ms: c.service_p95_ms==null ? null : Number(c.service_p95_ms), cohort: c.cohort === 'reopen' ? 'reopen' : 'first',
                exposures: Number(c.exposures), origins: Number(c.origins), unknownOrigins: Number(c.unknown_origins),
                reportedExposures: Number(c.reported_exposures), reportedItems: Number(c.reported_items),
                linkedChoices: Number(c.linked_choices), linkedWithAck: Number(c.linked_with_ack),
                linkedWithoutAck: Number(c.linked_choices)-Number(c.linked_with_ack),
                currentChoiceDiffers: Number(c.current_choice_differs),laterEdits: Number(c.later_edits) })),
            choices: (Array.isArray(row?.choices) ? row.choices : []).map(c => ({ cohort: String(c.cohort), outcome: String(c.outcome), count: Number(c.count) })),
            generations: generations.map(g => {
                const usage = Object.fromEntries(usageMetrics.map(metric => [metric,g[metric]])) as AiLineageReport['generations'][number]['usage'];
                const reported = Object.fromEntries(usageMetrics.map(metric => [metric,usage[metric]?.sum ?? null])) as ReportedUsage;
                return { feature: String(g.feature), source: String(g.source), model: g.model == null ? null : String(g.model),
                    prompt: String(g.prompt), listKind: String(g.list_kind), count: Number(g.count), attempts: Number(g.attempts),
                    recovered: Number(g.recovered), incomplete: Number(g.incomplete), usage,
                    estimate: reportedCostEstimate(reported,g.model == null ? null : String(g.model),Number(g.incomplete)===0 && Number(g.attempts)>0) };
            }),
        };
    } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
        return { state: isMissingRelationError(error) || code === '42703' ? 'not_installed' : 'unavailable', ...empty };
    }
}
