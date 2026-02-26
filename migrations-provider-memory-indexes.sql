-- Provider memory indexes for org-scoped suggestion ranking

CREATE INDEX IF NOT EXISTS idx_requests_account_org_id
ON requests (account_id, organization_id, id);

CREATE INDEX IF NOT EXISTS idx_utility_entries_request_category_created
ON utility_entries (request_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_utility_entries_normalized_provider_name
ON utility_entries (
    LOWER(
        REGEXP_REPLACE(
            TRIM(COALESCE(display_name, raw_text, '')),
            '[[:space:]]+',
            ' ',
            'g'
        )
    )
);
