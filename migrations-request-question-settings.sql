-- Apply before deploying request-specific seller question controls.
-- NULL preserves live account inheritance for existing and reusable requests.
ALTER TABLE requests
    ADD COLUMN IF NOT EXISTS collect_hoa_questions BOOLEAN,
    ADD COLUMN IF NOT EXISTS collect_electric_meter_number BOOLEAN;
