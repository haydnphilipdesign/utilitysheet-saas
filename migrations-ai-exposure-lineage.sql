-- Slice 8 additive migration. Authoring only; execution requires owner approval.
ALTER TABLE ai_generation_runs
    ADD COLUMN IF NOT EXISTS lineage_version INTEGER CHECK (lineage_version IS NULL OR lineage_version = 2),
    ADD COLUMN IF NOT EXISTS transport_summary JSONB CHECK (transport_summary IS NULL OR
        (transport_summary->>'v' = '1' AND jsonb_typeof(transport_summary->'attempts') = 'array'
         AND jsonb_array_length(transport_summary->'attempts') <= 9 AND octet_length(transport_summary::text) <= 16000)),
    ADD COLUMN IF NOT EXISTS transport_attempt_count INTEGER CHECK (transport_attempt_count BETWEEN 0 AND 9),
    ADD COLUMN IF NOT EXISTS usage_coverage JSONB CHECK (usage_coverage IS NULL OR (jsonb_typeof(usage_coverage) = 'object' AND octet_length(usage_coverage::text) <= 4000)),
    ADD COLUMN IF NOT EXISTS grounding_requested BOOLEAN,
    ADD COLUMN IF NOT EXISTS summary_truncated BOOLEAN;

CREATE TABLE IF NOT EXISTS ai_result_exposures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    edit_version INTEGER NOT NULL CHECK (edit_version BETWEEN 0 AND 1000000),
    mode TEXT NOT NULL CHECK (mode IN ('live', 'test')),
    feature TEXT NOT NULL CHECK (feature IN ('provider_suggestions', 'provider_search', 'provider_contact')),
    category TEXT CHECK (category IS NULL OR category IN ('electric','gas','water','sewer','trash','internet','cable','propane','oil')),
    run_id UUID REFERENCES ai_generation_runs(id) ON DELETE SET NULL,
    delivery_kind TEXT NOT NULL CHECK (delivery_kind IN ('fresh','shared','cache')),
    lookup_state TEXT NOT NULL CHECK (lookup_state IN ('collected','origin_unavailable','disabled','unconfigured','circuit_open','deadline','historical_contact','submitted_contact')),
    service_duration_ms INTEGER NOT NULL CHECK (service_duration_ms BETWEEN 0 AND 2000000000),
    origin_metadata JSONB NOT NULL CHECK (origin_metadata->>'v' = '1' AND origin_metadata->>'lineageVersion' = '2'
        AND origin_metadata->>'source' IN ('ai_primary','ai_verify','ai_recovery','history_blend','fallback','disabled','skipped')
        AND origin_metadata->>'status' IN ('success','fallback','error','parse_error','quality_rejected')
        AND origin_metadata->>'listKind' IN ('ai','common','no_list')
        AND jsonb_typeof(origin_metadata) = 'object' AND octet_length(origin_metadata::text) <= 4000),
    served_item_ids UUID[] NOT NULL DEFAULT '{}' CHECK (cardinality(served_item_ids) <= 50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ai_selection_observations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    edit_version INTEGER NOT NULL CHECK (edit_version BETWEEN 0 AND 1000000),
    category TEXT NOT NULL CHECK (category IN ('electric','gas','water','sewer','trash','internet','cable','propane','oil')),
    entry_mode TEXT NOT NULL CHECK (entry_mode IN ('suggested_confirmed','search_selected','free_text','unknown','not_applicable')),
    exposure_id UUID REFERENCES ai_result_exposures(id) ON DELETE SET NULL,
    run_id UUID REFERENCES ai_generation_runs(id) ON DELETE SET NULL,
    item_id UUID REFERENCES ai_suggestion_items(id) ON DELETE SET NULL,
    linkage_outcome TEXT NOT NULL CHECK (linkage_outcome IN ('linked','missing','invalid','stale','origin_unavailable')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(request_id, edit_version, category)
);
CREATE INDEX IF NOT EXISTS idx_ai_exposures_request_edit_category ON ai_result_exposures(request_id, edit_version, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_exposures_run ON ai_result_exposures(run_id);
CREATE INDEX IF NOT EXISTS idx_ai_exposures_created ON ai_result_exposures(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_choices_created ON ai_selection_observations(created_at);
