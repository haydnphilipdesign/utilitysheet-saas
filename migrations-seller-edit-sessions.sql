-- Seller editing sessions: read-only after submission, coordinator reopen.
-- Decision: .ai/decisions/2026-10-06-read-only-after-submission-and-reopen.md
--
-- Apply BEFORE deploying the code that reads these columns. Both changes are
-- additive, so the code already running ignores them and is unaffected.
--
-- seller_edit_version: 0 for the first editing session; each reopen, and each
--   "close without changes", adds 1. A seller submission is accepted only when
--   it carries the current value, so a tab or draft from an earlier session
--   cannot overwrite the sheet.
-- seller_submission_key: the random key sent with the accepted submission of
--   the current session. A retry carrying the same key is answered as already
--   stored instead of being refused. Cleared on reopen. Not personal data.
--
-- Existing rows take the defaults (0 and NULL). No data is rewritten.

ALTER TABLE requests ADD COLUMN IF NOT EXISTS seller_edit_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS seller_submission_key TEXT;
