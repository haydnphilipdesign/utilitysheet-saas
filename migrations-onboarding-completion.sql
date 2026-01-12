-- UtilitySheet Migration: Track onboarding completion
-- Run this in your Neon SQL Editor

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_accounts_onboarding_completed_at ON accounts(onboarding_completed_at);
