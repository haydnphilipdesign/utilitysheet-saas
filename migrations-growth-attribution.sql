CREATE TABLE IF NOT EXISTS growth_attributions (
    account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    source TEXT,
    medium TEXT,
    campaign TEXT,
    content TEXT,
    referral_code TEXT,
    landing_path TEXT NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (char_length(source) <= 100),
    CHECK (char_length(medium) <= 100),
    CHECK (char_length(campaign) <= 100),
    CHECK (char_length(content) <= 100),
    CHECK (char_length(referral_code) <= 60),
    CHECK (char_length(landing_path) <= 200)
);

CREATE INDEX IF NOT EXISTS idx_growth_attributions_source
    ON growth_attributions(source, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_growth_attributions_referral_code
    ON growth_attributions(referral_code)
    WHERE referral_code IS NOT NULL;
