-- Maintenance switch controlled from Admin > Maintenance.
--
-- Additive and idempotent. One row at most. Until this is applied the switch
-- reads as off, the Admin page says it is not installed, and the
-- MAINTENANCE_MODE environment setting keeps working on its own.
--
-- Stores no customer, seller or request data.

CREATE TABLE IF NOT EXISTS maintenance_state (
    -- Always TRUE: the primary key plus the check allow exactly one row.
    id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    -- Optional estimate shown to people while it is still in the future.
    expected_back_at TIMESTAMPTZ,
    -- When the current pause began. NULL while off.
    enabled_at TIMESTAMPTZ,
    version INT NOT NULL DEFAULT 0 CHECK (version >= 0),
    updated_by UUID REFERENCES accounts(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (enabled OR (expected_back_at IS NULL AND enabled_at IS NULL))
);

INSERT INTO maintenance_state (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;
