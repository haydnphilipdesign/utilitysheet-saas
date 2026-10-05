-- Operational observations for the Admin Operations page and quiet alerts.
-- Additive and idempotent. Safe to run before or after the application deploy:
-- writers are best-effort and readers report "not installed" while tables are missing.
--
-- These tables hold transient operational telemetry, not audit evidence.
-- They are pruned on a retention window (default 90 days); admin_audit_logs and
-- reminder_operations are never pruned with them.
--
-- Metadata is allowlisted by the application (lib/ops/events.ts): no URLs with
-- tokens, seller answers, email bodies, provider payloads, raw exceptions or
-- contact fields.

CREATE TABLE IF NOT EXISTS operational_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN ('email', 'pdf', 'billing_webhook')),
    code TEXT NOT NULL CHECK (char_length(code) BETWEEN 1 AND 80),
    outcome TEXT NOT NULL CHECK (outcome IN ('failure', 'success')),
    severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
    -- Stable grouping key for an incident, for example 'pdf:generation_failed'.
    fingerprint TEXT NOT NULL CHECK (char_length(fingerprint) BETWEEN 1 AND 160),
    -- References survive deletion of the customer record as NULL; history never blocks account closure.
    request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    -- Stripe event ID or Resend webhook message ID. Deduplicates provider retries.
    provider_event_id TEXT CHECK (provider_event_id IS NULL OR char_length(provider_event_id) <= 200),
    correlation_id TEXT CHECK (correlation_id IS NULL OR char_length(correlation_id) <= 200),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Provider redeliveries of the same event bump this instead of adding rows.
    attempts INT NOT NULL DEFAULT 1,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS operational_events_provider_dedupe
    ON operational_events(category, provider_event_id, outcome) WHERE provider_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_operational_events_occurred ON operational_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_operational_events_fingerprint ON operational_events(fingerprint, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_operational_events_category_outcome
    ON operational_events(category, outcome, occurred_at DESC);

-- One row per scheduled job execution. Summary holds counts only.
CREATE TABLE IF NOT EXISTS job_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name TEXT NOT NULL CHECK (char_length(job_name) BETWEEN 1 AND 80),
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'failed')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    duration_ms INT,
    summary JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_job_runs_name_started ON job_runs(job_name, started_at DESC);

-- Notification state per alert condition, so an unchanged state is never re-sent.
CREATE TABLE IF NOT EXISTS ops_alert_state (
    alert_key TEXT PRIMARY KEY CHECK (char_length(alert_key) BETWEEN 1 AND 120),
    status TEXT NOT NULL CHECK (status IN ('firing', 'ok')),
    episode_started_at TIMESTAMPTZ,
    last_notified_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
