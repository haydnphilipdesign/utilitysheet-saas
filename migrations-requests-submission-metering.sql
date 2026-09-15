-- Requests: meter on seller submission only
-- Generated: 2026-09-15
--
-- Purpose:
-- - Free plan usage now counts seller submissions, not created or sent requests.
-- - Clear `metered_at` on requests that old code metered at creation/send but that
--   were never submitted, so they stop counting and receive the over-limit lock
--   check if a seller submits later.
-- - Keep every request that was ever submitted metered (current status or a
--   `seller_submitted` event), including soft-deleted rows, so deleting cannot
--   reset usage. Locked rows are left untouched.
--
-- Deploy order: run AFTER the application code that stops metering at creation is
-- live. Idempotent and safe to re-run to catch rows metered in between.
-- No schema shape change; schema.sql is unchanged.

UPDATE requests r
SET metered_at = NULL
WHERE r.metered_at IS NOT NULL
  AND r.status <> 'submitted'
  AND COALESCE(r.is_locked, FALSE) = FALSE
  AND NOT EXISTS (
      SELECT 1
      FROM event_logs e
      WHERE e.request_id = r.id
        AND e.event_type = 'seller_submitted'
  );
