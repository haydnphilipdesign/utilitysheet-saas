-- Testimonial outreach logging for manual admin testimonial request emails.

CREATE TABLE IF NOT EXISTS testimonial_outreach_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    subject TEXT NOT NULL,
    resend_email_id TEXT,
    sent_by_admin_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'dry_run')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_testimonial_outreach_logs_user_sent_at
    ON testimonial_outreach_logs(user_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_testimonial_outreach_logs_admin_sent_at
    ON testimonial_outreach_logs(sent_by_admin_id, sent_at DESC);

