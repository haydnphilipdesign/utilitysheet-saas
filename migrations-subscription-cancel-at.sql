-- When a plan that is set to cancel will end.
-- Adds accounts.subscription_cancel_at and organizations.subscription_cancel_at
-- (nullable; NULL means the plan renews or there is no plan). The billing webhook
-- writes them from Stripe's cancel_at; Settings > Billing reads them.
-- Additive and rerunnable; changes no existing row. APPLY BEFORE deploying the
-- application that writes these columns: its subscription webhook updates name
-- them and fail without them. Applying this to any live database requires owner
-- authorization.
BEGIN;

ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS subscription_cancel_at TIMESTAMPTZ;

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS subscription_cancel_at TIMESTAMPTZ;

COMMIT;
