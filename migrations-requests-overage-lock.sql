-- Requests: overage locking (for intake link submissions)
-- Generated: 2026-02-03
--
-- Purpose:
-- - Allow seller submissions to continue even when the agent is over the free plan limit.
-- - Mark over-limit requests as locked so they can be hidden from the dashboard until upgrade.

ALTER TABLE requests
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE requests
ADD COLUMN IF NOT EXISTS locked_reason TEXT;

ALTER TABLE requests
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_requests_is_locked ON requests(is_locked);

