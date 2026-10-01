-- Requests: HOA / condo association questions (Home Basics)
-- Generated: 2026-10-01
--
-- Purpose:
-- - Add the "Is this home part of an HOA or condo association?" gate and its
--   detail answers to Home Basics, which is asked on every seller form, in both
--   packet modes, on every plan.
-- - `has_hoa` is association membership. It is unrelated to the `hoa` value on
--   `water_source` / `sewer_type`, which means the association bills that utility.
-- - NULL `has_hoa` means the question was never asked, which is every row that
--   predates this migration. It is distinct from 'not_sure'.
-- - The detail columns are only meaningful when `has_hoa = 'yes'`. Application
--   code must clear them otherwise. Length limits live in the Zod schemas, as
--   they do for the other free-text columns on `requests`.
-- - `hoa_dues_amount` holds the amount alone; `hoa_dues_frequency` holds the
--   billing period.
--
-- Deploy order: run BEFORE deploying application code that reads or writes these
-- columns. Additive and nullable, so the currently deployed code is unaffected.
-- Idempotent and safe to re-run. No backfill; no existing row changes.
-- Mirrored in schema.sql.
--
-- History: the first six columns were applied on 2026-10-01. The contact name,
-- contact email, and dues frequency columns were added the same day, after the
-- requesting customer supplied the association addendum these answers feed.

ALTER TABLE requests
ADD COLUMN IF NOT EXISTS has_hoa TEXT CHECK (has_hoa IN ('yes', 'no', 'not_sure')),
ADD COLUMN IF NOT EXISTS hoa_name TEXT,
ADD COLUMN IF NOT EXISTS hoa_management_company TEXT,
ADD COLUMN IF NOT EXISTS hoa_management_phone TEXT,
ADD COLUMN IF NOT EXISTS hoa_dues_amount TEXT,
ADD COLUMN IF NOT EXISTS hoa_portal_or_payment TEXT,
ADD COLUMN IF NOT EXISTS hoa_management_contact TEXT,
ADD COLUMN IF NOT EXISTS hoa_management_email TEXT,
ADD COLUMN IF NOT EXISTS hoa_dues_frequency TEXT CHECK (hoa_dues_frequency IN ('monthly', 'quarterly', 'yearly'));
