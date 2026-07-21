-- Durable audit trail for self-service account security controls.
-- Creating this migration does not authorize running it against any live database.

CREATE TABLE IF NOT EXISTS account_security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (char_length(action) BETWEEN 1 AND 80),
    status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failure')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_security_events_account_created
    ON account_security_events(account_id, created_at DESC);
