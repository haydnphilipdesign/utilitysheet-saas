-- Durable seller reminder operations.
-- Additive and idempotent. Run BEFORE deploying the application code that reads it:
-- the reminder endpoints fail closed (no send) while this table is missing.
--
-- One row per logical reminder. The row is the claim that prevents double sends,
-- the provider idempotency identity for safe retries, and the recoverable record
-- of an ambiguous outcome. It never stores capability tokens or rendered bodies.

CREATE TABLE IF NOT EXISTS reminder_operations (
    -- Supplied by the caller and reused on retry. Also the provider idempotency key.
    id UUID PRIMARY KEY,
    -- Reminders have no meaning without their request; removing it removes these rows.
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL DEFAULT 'seller_reminder' CHECK (purpose IN ('seller_reminder')),
    actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'agent')),
    actor_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    reason TEXT CHECK (reason IS NULL OR char_length(reason) <= 500),
    recipient_email TEXT NOT NULL CHECK (char_length(recipient_email) <= 254),
    -- SHA-256 of the exact rendered payload. A retry must reproduce it.
    payload_fingerprint TEXT NOT NULL CHECK (payload_fingerprint ~ '^[a-f0-9]{64}$'),
    state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'accepted', 'failed', 'unknown')),
    provider_message_id TEXT CHECK (provider_message_id IS NULL OR char_length(provider_message_id) <= 200),
    failure_code TEXT CHECK (failure_code IS NULL OR char_length(failure_code) <= 80),
    attempt_count INT NOT NULL DEFAULT 1,
    -- Provider delivery evidence (see migrations-operational-events.sql). NULL means unknown.
    delivery_status TEXT CHECK (delivery_status IS NULL OR delivery_status IN ('delivered', 'delayed', 'bounced', 'complained', 'failed')),
    delivery_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    finalized_at TIMESTAMPTZ
);

-- At most one in-flight reminder per request, enforced by the database.
CREATE UNIQUE INDEX IF NOT EXISTS reminder_operations_one_pending
    ON reminder_operations(request_id, purpose) WHERE state = 'pending';
CREATE INDEX IF NOT EXISTS idx_reminder_operations_request_created
    ON reminder_operations(request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminder_operations_provider_message
    ON reminder_operations(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reminder_operations_unresolved
    ON reminder_operations(updated_at) WHERE state IN ('pending', 'unknown');
