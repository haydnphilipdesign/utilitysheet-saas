-- Stored customer feedback from the dashboard Feedback dialog, with the review
-- state shown on /admin/feedback.
-- Additive and idempotent. Run BEFORE deploying the code that uses it: the
-- feedback route and the Admin page tolerate a missing table, but account
-- closure deletes from this table inside its transaction.
--
-- `message` is customer free text and may contain personal details. It must
-- never be copied into logs, analytics, audit metadata or AI provider calls.

CREATE TABLE IF NOT EXISTS feedback_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    category TEXT NOT NULL DEFAULT 'general'
        CHECK (category IN ('bug', 'idea', 'question', 'general')),
    message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
    -- Path only (no query string or fragment) of the page the dialog was opened on.
    page_path TEXT CHECK (page_path IS NULL OR char_length(page_path) <= 300),
    viewport TEXT CHECK (viewport IS NULL OR char_length(viewport) <= 20),
    user_agent TEXT CHECK (user_agent IS NULL OR char_length(user_agent) <= 400),
    -- Outcome of the notification email. The row is the record; the email is a courtesy.
    email_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (email_status IN ('pending', 'sent', 'failed')),
    status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'reviewed', 'resolved')),
    -- Private internal note. Plain text, never sent to the customer.
    note TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
    -- Incremented on every Admin change; a write must name the version it read.
    version INT NOT NULL DEFAULT 1,
    updated_by UUID REFERENCES accounts(id) ON DELETE SET NULL,
    status_changed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_submissions_created_at
    ON feedback_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_submissions_status_created_at
    ON feedback_submissions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_submissions_account_created_at
    ON feedback_submissions(account_id, created_at DESC);
