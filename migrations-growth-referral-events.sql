-- Server-side counters for the transaction-exposure referral loop.
-- Stores no seller identity, property address, request token, IP, or user agent.
CREATE TABLE IF NOT EXISTS growth_referral_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'click')),
    surface TEXT NOT NULL DEFAULT 'packet_share_page',
    referral_code TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (char_length(surface) <= 40),
    CHECK (char_length(referral_code) <= 60)
);

CREATE INDEX IF NOT EXISTS idx_growth_referral_events_type_time
    ON growth_referral_events(event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_growth_referral_events_referral_code
    ON growth_referral_events(referral_code)
    WHERE referral_code IS NOT NULL;
