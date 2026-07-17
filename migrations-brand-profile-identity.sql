-- Structured professional identity fields for brand profiles.
--
-- These optional, free-form fields let agents/brokerages carry their company,
-- role, and license/compliance identity on the deliverable without overloading
-- the free-text disclaimer. All are nullable and backward compatible: existing
-- profiles keep NULL and render nothing (no blank spacing on any surface).
--
-- Safe to run more than once (IF NOT EXISTS). No data backfill required.

ALTER TABLE brand_profiles
    ADD COLUMN IF NOT EXISTS company_name TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS professional_title TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS license_number TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS license_state TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS compliance_line TEXT DEFAULT NULL;
