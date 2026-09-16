-- Self-serve account closure lifecycle.
-- Decision: .ai/decisions/2026-09-16-self-serve-account-closure-lifecycle.md
-- Additive and idempotent. Apply before deploying the closure feature.

BEGIN;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS closure_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS closure_requested_at TIMESTAMPTZ;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'accounts_closure_status_check'
    ) THEN
        ALTER TABLE accounts
            ADD CONSTRAINT accounts_closure_status_check
            CHECK (closure_status IN ('active', 'closing', 'closed'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_accounts_closure_status
    ON accounts(closure_status)
    WHERE closure_status <> 'active';

-- One row per closure. notify_email holds the pre-closure address only until
-- the confirmation email is sent; pending_blob_urls lists candidate logo blobs.
CREATE TABLE IF NOT EXISTS account_closures (
    account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    step TEXT NOT NULL DEFAULT 'requested'
        CHECK (step IN ('requested', 'billing_canceled', 'data_removed', 'assets_removed', 'auth_deleted', 'completed')),
    transfers JSONB NOT NULL DEFAULT '{}'::jsonb,
    notify_email TEXT,
    pending_blob_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    attempt_count INT NOT NULL DEFAULT 0,
    last_error_code TEXT CHECK (last_error_code IS NULL OR char_length(last_error_code) <= 80),
    lease_until TIMESTAMPTZ,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_account_closures_pending
    ON account_closures(updated_at)
    WHERE step <> 'completed';

-- Unapplied referral credits are forfeited when the referrer closes their account.
ALTER TABLE referral_credits DROP CONSTRAINT IF EXISTS referral_credits_status_check;
ALTER TABLE referral_credits
    ADD CONSTRAINT referral_credits_status_check
    CHECK (status IN ('earned', 'applied', 'forfeited'));

COMMIT;
