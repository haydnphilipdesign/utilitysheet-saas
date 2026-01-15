-- Requests: metering + soft-delete
-- Generated: 2026-01-15
--
-- Purpose:
-- - Prevent quota/usage abuse by keeping metered requests in the system even after user deletion.
-- - Track the moment a request becomes quota-relevant via `metered_at` (drafts remain unmetered).

ALTER TABLE requests
ADD COLUMN IF NOT EXISTS metered_at TIMESTAMPTZ;

ALTER TABLE requests
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Backfill metering timestamp for existing non-draft requests.
UPDATE requests
SET metered_at = created_at
WHERE metered_at IS NULL
  AND status <> 'draft';

CREATE INDEX IF NOT EXISTS idx_requests_metered_at ON requests(metered_at);
CREATE INDEX IF NOT EXISTS idx_requests_deleted_at ON requests(deleted_at);

