-- Utility entries: optional electric meter number
-- Generated: 2026-02-24

ALTER TABLE utility_entries
ADD COLUMN IF NOT EXISTS meter_number TEXT;
