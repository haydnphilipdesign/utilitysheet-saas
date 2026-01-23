-- Migration: Add editable message templates to brand profiles
-- Run this on your Neon database

ALTER TABLE brand_profiles
ADD COLUMN IF NOT EXISTS message_templates JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN brand_profiles.message_templates IS 'JSON overrides for seller-request email/SMS templates per brand profile.';

