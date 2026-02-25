-- Utility entries: structured extra metadata (trash/recycling schedule, etc.)
-- Generated: 2026-02-25

ALTER TABLE utility_entries
ADD COLUMN IF NOT EXISTS extra JSONB NOT NULL DEFAULT '{}'::jsonb;
