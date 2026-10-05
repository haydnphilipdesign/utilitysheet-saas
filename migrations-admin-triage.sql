-- Minimal Admin triage state for the Operations page.
-- Additive and idempotent. Run before or after deploy: the Operations page
-- reports triage as "not installed" and disables its controls while this is missing.
--
-- A row records only how an operator has dealt with an item identified by a
-- stable source key (for example `incident:pdf:generation_failed` or
-- `request_inactive:<request id>`). It never changes the underlying customer
-- record, request status, backlog counts or analytics, and never triggers a message.

CREATE TABLE IF NOT EXISTS admin_triage_items (
    source_key TEXT PRIMARY KEY CHECK (char_length(source_key) BETWEEN 3 AND 200),
    kind TEXT NOT NULL CHECK (kind IN ('service', 'follow_up')),
    state TEXT NOT NULL CHECK (state IN ('open', 'acknowledged', 'snoozed', 'resolved')),
    snoozed_until TIMESTAMPTZ,
    -- Private internal note. Plain text, never included in alerts or external messages.
    note TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
    -- Incremented on every change; a write must name the version it read.
    version INT NOT NULL DEFAULT 1,
    updated_by UUID REFERENCES accounts(id) ON DELETE SET NULL,
    state_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (state <> 'snoozed' OR snoozed_until IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_admin_triage_items_state ON admin_triage_items(state, updated_at DESC);
