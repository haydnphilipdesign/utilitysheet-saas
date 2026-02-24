-- Admin V2 performance indexes
-- Improves admin list sorting and filtering workloads.

CREATE INDEX IF NOT EXISTS idx_accounts_created_at_desc ON accounts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_role_plan_created_at_desc
    ON accounts(role, subscription_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);

-- Optional: enable trigram search indexes in environments where pg_trgm is available.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm') THEN
        CREATE EXTENSION IF NOT EXISTS pg_trgm;
        CREATE INDEX IF NOT EXISTS idx_accounts_email_trgm
            ON accounts USING gin (email gin_trgm_ops);
        CREATE INDEX IF NOT EXISTS idx_accounts_full_name_trgm
            ON accounts USING gin (full_name gin_trgm_ops);
        CREATE INDEX IF NOT EXISTS idx_accounts_company_name_trgm
            ON accounts USING gin (company_name gin_trgm_ops);
    END IF;
END $$;
