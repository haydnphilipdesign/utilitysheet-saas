-- AI suggestion telemetry foundation.
-- Stores redacted run/item metadata only. No raw prompts, responses, street
-- addresses, seller names, account numbers, IPs, or full submission payloads.

CREATE TABLE IF NOT EXISTS ai_generation_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    feature TEXT NOT NULL CHECK (feature IN ('provider_suggestions', 'provider_search')),
    category TEXT,
    provider TEXT NOT NULL DEFAULT 'gemini',
    model TEXT,
    prompt_version TEXT NOT NULL,
    served_pipeline TEXT,
    source TEXT,
    status TEXT NOT NULL CHECK (status IN ('success', 'fallback', 'error', 'parse_error', 'quality_rejected')),
    reason_code TEXT,
    upstream_reason_code TEXT,
    latency_ms INTEGER,
    attempt_count INTEGER,
    locality_state TEXT,
    locality_zip3 TEXT,
    locality_city TEXT,
    suggestion_count INTEGER NOT NULL DEFAULT 0,
    cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_suggestion_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES ai_generation_runs(id) ON DELETE CASCADE,
    request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
    category TEXT,
    rank INTEGER NOT NULL,
    display_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    canonical_id TEXT,
    confidence NUMERIC(3,2),
    source TEXT,
    contact_present BOOLEAN NOT NULL DEFAULT FALSE,
    selected_by_seller BOOLEAN,
    final_entry_mode TEXT,
    final_provider_name TEXT,
    final_canonical_id TEXT,
    final_confidence_score NUMERIC(3,2),
    selected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_generation_runs_request_created
    ON ai_generation_runs(request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_generation_runs_feature_category_created
    ON ai_generation_runs(feature, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_generation_runs_status_created
    ON ai_generation_runs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_suggestion_items_request_category_name
    ON ai_suggestion_items(request_id, category, normalized_name);

CREATE INDEX IF NOT EXISTS idx_ai_suggestion_items_run_rank
    ON ai_suggestion_items(run_id, rank);
