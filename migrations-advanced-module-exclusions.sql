-- Requests/intake links: persist field-level advanced-module exclusions
-- Generated: 2026-02-25

ALTER TABLE requests
ADD COLUMN IF NOT EXISTS advanced_module_exclusions JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE intake_links
ADD COLUMN IF NOT EXISTS advanced_module_exclusions JSONB NOT NULL DEFAULT '{}'::jsonb;
