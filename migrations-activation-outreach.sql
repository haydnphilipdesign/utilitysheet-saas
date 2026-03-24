CREATE TABLE IF NOT EXISTS activation_outreach_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    auth_user_id TEXT,
    email TEXT NOT NULL,
    campaign TEXT NOT NULL DEFAULT 'activation_reengagement',
    stage TEXT NOT NULL CHECK (stage IN ('after_15m', 'after_1d')),
    status TEXT NOT NULL CHECK (status IN ('sent', 'skipped', 'failed')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id, campaign, stage)
);

CREATE INDEX IF NOT EXISTS idx_activation_outreach_logs_account_campaign_stage
    ON activation_outreach_logs(account_id, campaign, stage);

CREATE INDEX IF NOT EXISTS idx_activation_outreach_logs_sent_at
    ON activation_outreach_logs(sent_at DESC);
