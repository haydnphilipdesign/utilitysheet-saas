-- Structured capture of seller-form questions customers want but cannot find.

CREATE TABLE IF NOT EXISTS question_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    requested_text TEXT NOT NULL,
    context TEXT NOT NULL CHECK (context IN ('settings', 'request_creation')),
    packet_mode TEXT CHECK (packet_mode IN ('simple', 'advanced')),
    status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'reviewed', 'planned', 'declined')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_question_requests_created_at
    ON question_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_requests_account_created_at
    ON question_requests(account_id, created_at DESC);
