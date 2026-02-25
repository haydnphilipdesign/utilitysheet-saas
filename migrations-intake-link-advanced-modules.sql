-- Intake links: persist advanced module defaults for reusable-link starts
-- Generated: 2026-02-25

ALTER TABLE intake_links
ADD COLUMN IF NOT EXISTS advanced_modules TEXT[] NOT NULL DEFAULT '{}'::text[];
