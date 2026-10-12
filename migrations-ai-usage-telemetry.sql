-- AI usage telemetry and the AI health observation.
-- 1. ai_generation_runs gains nullable usage columns (tokens, searches, sources,
--    thinking level, kind of model-call failure). NULL means not recorded: every
--    row written before this migration, and every cache hit.
-- 2. ai_generation_runs.feature also accepts 'provider_contact' (contact lookups
--    made after a seller submits). No provider name is stored for them.
-- 3. operational_events.category also accepts 'ai', written by the ops monitor
--    when too many fresh AI runs end badly.
-- Additive and rerunnable; changes no existing row. Both checks are only widened,
-- so the deployed application keeps working. APPLY BEFORE deploying the
-- application that writes these columns: its telemetry insert names them and is
-- dropped (best-effort, the seller flow is unaffected) without them. Applying
-- this to any live database requires owner authorization.
BEGIN;

ALTER TABLE ai_generation_runs
    ADD COLUMN IF NOT EXISTS prompt_tokens INTEGER,
    ADD COLUMN IF NOT EXISTS output_tokens INTEGER,
    ADD COLUMN IF NOT EXISTS thinking_tokens INTEGER,
    ADD COLUMN IF NOT EXISTS tool_prompt_tokens INTEGER,
    ADD COLUMN IF NOT EXISTS search_query_count INTEGER,
    ADD COLUMN IF NOT EXISTS source_count INTEGER,
    ADD COLUMN IF NOT EXISTS thinking_level TEXT,
    ADD COLUMN IF NOT EXISTS error_kind TEXT;

ALTER TABLE ai_generation_runs DROP CONSTRAINT IF EXISTS ai_generation_runs_feature_check;
ALTER TABLE ai_generation_runs ADD CONSTRAINT ai_generation_runs_feature_check
    CHECK (feature IN ('provider_suggestions', 'provider_search', 'provider_contact'));

-- The ops monitor reads the last day of runs every 15 minutes.
CREATE INDEX IF NOT EXISTS idx_ai_generation_runs_created
    ON ai_generation_runs(created_at DESC);

-- operational_events comes from migrations-operational-events.sql; skipped where
-- that has not been applied.
ALTER TABLE IF EXISTS operational_events DROP CONSTRAINT IF EXISTS operational_events_category_check;
ALTER TABLE IF EXISTS operational_events ADD CONSTRAINT operational_events_category_check
    CHECK (category IN ('email', 'pdf', 'billing_webhook', 'ai'));

COMMIT;
