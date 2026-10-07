-- Why and when a workspace's Teams plan stopped.
-- Adds organizations.subscription_lapse_reason and organizations.subscription_lapsed_at
-- (both nullable; NULL means the plan is active or the workspace never had one).
-- The billing webhook writes them when a Teams plan stops and clears them when
-- Teams is active again; Settings > Billing and the dashboard read them.
--   payment_failed        the payment did not go through and Stripe is still trying
--   payment_failed_ended  the plan was canceled after the payment kept failing
--   ended                 the plan was canceled or otherwise ended
-- Additive and rerunnable; changes no existing row. APPLY BEFORE deploying the
-- application that writes these columns: its subscription webhook updates name
-- them and fail without them. Applying this to any live database requires owner
-- authorization.
BEGIN;

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS subscription_lapse_reason TEXT,
    ADD COLUMN IF NOT EXISTS subscription_lapsed_at TIMESTAMPTZ;

ALTER TABLE organizations
    DROP CONSTRAINT IF EXISTS organizations_subscription_lapse_reason_check;

ALTER TABLE organizations
    ADD CONSTRAINT organizations_subscription_lapse_reason_check
    CHECK (subscription_lapse_reason IN ('payment_failed', 'payment_failed_ended', 'ended'));

COMMIT;
