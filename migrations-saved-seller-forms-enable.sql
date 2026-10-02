-- Phase 3, only after all old writers drain and compatibility checks pass.
-- This file does not authorize a live migration or enabling the rollout gate.
BEGIN;
LOCK TABLE intake_links IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM intake_links WHERE NOT scope_initialized)
        OR EXISTS (SELECT 1 FROM intake_links il WHERE NOT EXISTS (
            SELECT 1 FROM intake_link_aliases a WHERE a.slug = il.slug AND a.intake_link_id = il.id
        )) THEN RAISE EXCEPTION 'Saved forms compatibility backfill is incomplete'; END IF;
    IF EXISTS (SELECT account_id FROM intake_links GROUP BY account_id HAVING COUNT(*) FILTER (WHERE is_referral_identity) <> 1)
        OR EXISTS (SELECT account_id, organization_id FROM intake_links GROUP BY account_id, organization_id HAVING COUNT(*) FILTER (WHERE is_default) <> 1)
    THEN RAISE EXCEPTION 'Saved forms default/referral invariants are incomplete'; END IF;
END $$;
ALTER TABLE intake_links DROP CONSTRAINT IF EXISTS intake_links_account_id_key;
COMMIT;
