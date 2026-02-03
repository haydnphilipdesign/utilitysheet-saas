-- Intake Links (reusable seller URL per account)
-- Generated: 2026-02-03
--
-- Purpose:
-- - Allow an agent to share one fixed URL repeatedly.
-- - Seller enters property address at the beginning; a request is created from the intake link.

CREATE TABLE IF NOT EXISTS intake_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    slug TEXT UNIQUE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id)
);

CREATE INDEX IF NOT EXISTS idx_intake_links_account_id ON intake_links(account_id);
CREATE INDEX IF NOT EXISTS idx_intake_links_slug ON intake_links(slug);

DROP TRIGGER IF EXISTS update_intake_links_updated_at ON intake_links;
CREATE TRIGGER update_intake_links_updated_at
    BEFORE UPDATE ON intake_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

