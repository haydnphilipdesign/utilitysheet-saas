-- When a Pro free trial (the referral free month) ends.
-- Adds accounts.subscription_trial_ends_at (nullable; NULL means the plan is not
-- in a trial). The billing webhook writes it from Stripe's trial_end while the
-- subscription is trialing; Settings > Billing reads it.
-- Follows migrations-subscription-cancel-at.sql. Additive and rerunnable;
-- changes no existing row. APPLY BEFORE deploying the application that writes
-- this column: its subscription webhook update names it and fails without it.
-- Applying this to any live database requires owner authorization.
BEGIN;

ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS subscription_trial_ends_at TIMESTAMPTZ;

COMMIT;
