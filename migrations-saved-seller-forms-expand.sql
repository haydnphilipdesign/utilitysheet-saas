-- Phase 1: expand while intake_links_account_id_key still prevents multiple rows.
-- Rehearse locally. Applying this to any live database requires owner authorization.
BEGIN;
ALTER TABLE intake_links
    ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'My seller form' CHECK (length(btrim(name)) BETWEEN 1 AND 80),
    ADD COLUMN IF NOT EXISTS seller_intro TEXT CHECK (length(seller_intro) <= 500),
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS scope_initialized BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS is_referral_identity BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS collect_hoa_questions BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS collect_electric_meter_number BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0);

-- Abort rather than guessing a destination for an invalid active membership.
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM intake_links il JOIN accounts a ON a.id = il.account_id
        WHERE NOT il.scope_initialized AND a.active_organization_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM organization_members om
              WHERE om.account_id = a.id AND om.organization_id = a.active_organization_id)
    ) THEN RAISE EXCEPTION 'Saved forms backfill requires explicit resolution of invalid active memberships'; END IF;
END $$;
UPDATE intake_links il SET
    organization_id = a.active_organization_id,
    collect_hoa_questions = COALESCE(a.notification_preferences->'collect_hoa_questions', 'true'::jsonb) <> 'false'::jsonb,
    collect_electric_meter_number = COALESCE(a.notification_preferences->'collect_electric_meter_number', 'true'::jsonb) <> 'false'::jsonb,
    scope_initialized = TRUE
FROM accounts a WHERE a.id = il.account_id AND NOT il.scope_initialized;

CREATE UNIQUE INDEX IF NOT EXISTS seller_forms_personal_default ON intake_links(account_id)
    WHERE is_default AND organization_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS seller_forms_workspace_default ON intake_links(account_id, organization_id)
    WHERE is_default AND organization_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS seller_forms_referral_identity ON intake_links(account_id) WHERE is_referral_identity;
CREATE TABLE IF NOT EXISTS intake_link_aliases (
    slug TEXT PRIMARY KEY,
    intake_link_id UUID NOT NULL REFERENCES intake_links(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO intake_link_aliases(slug, intake_link_id)
    SELECT slug, id FROM intake_links ON CONFLICT DO NOTHING;

-- Old insert writers remain safe during the compatible deployment window.
CREATE OR REPLACE FUNCTION initialize_seller_form() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a accounts;
BEGIN
    SELECT * INTO a FROM accounts WHERE id = NEW.account_id FOR UPDATE;
    IF NOT NEW.scope_initialized THEN
        IF a.active_organization_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM organization_members WHERE account_id = a.id AND organization_id = a.active_organization_id
        ) THEN RAISE EXCEPTION 'Invalid form workspace'; END IF;
        NEW.organization_id := a.active_organization_id;
        NEW.collect_hoa_questions := COALESCE(a.notification_preferences->'collect_hoa_questions', 'true'::jsonb) <> 'false'::jsonb;
        NEW.collect_electric_meter_number := COALESCE(a.notification_preferences->'collect_electric_meter_number', 'true'::jsonb) <> 'false'::jsonb;
        NEW.scope_initialized := TRUE;
    END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS initialize_seller_form ON intake_links;
CREATE TRIGGER initialize_seller_form BEFORE INSERT ON intake_links FOR EACH ROW EXECUTE FUNCTION initialize_seller_form();

CREATE OR REPLACE FUNCTION register_seller_form_alias() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM intake_link_aliases WHERE slug = NEW.slug AND intake_link_id <> NEW.id) THEN
        RAISE EXCEPTION 'Slug already published' USING ERRCODE = '23505';
    END IF;
    INSERT INTO intake_link_aliases(slug, intake_link_id) VALUES (NEW.slug, NEW.id) ON CONFLICT DO NOTHING;
    IF EXISTS (SELECT 1 FROM intake_link_aliases WHERE slug = NEW.slug AND intake_link_id <> NEW.id) THEN
        RAISE EXCEPTION 'Slug already published' USING ERRCODE = '23505';
    END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS register_seller_form_alias ON intake_links;
CREATE TRIGGER register_seller_form_alias AFTER INSERT OR UPDATE OF slug ON intake_links
    FOR EACH ROW EXECUTE FUNCTION register_seller_form_alias();

ALTER TABLE requests
    ADD COLUMN IF NOT EXISTS source_form_id UUID REFERENCES intake_links(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS source_form_revision INTEGER,
    ADD COLUMN IF NOT EXISTS seller_intro TEXT CHECK (length(seller_intro) <= 500);

-- Resolve commercial allowance from the fixed scope, never a client plan/count.
-- Membership/owner checks are made by the allocating functions before this read.
CREATE OR REPLACE FUNCTION seller_form_allowance(p_account UUID, p_org UUID)
RETURNS INTEGER LANGUAGE sql STABLE AS $$
    SELECT CASE WHEN a.subscription_status = 'pro' OR EXISTS (
        SELECT 1 FROM organizations o WHERE o.id = p_org AND o.subscription_status = 'team'
    ) THEN 10 ELSE 1 END FROM accounts a WHERE a.id = p_account;
$$;

-- All form mutations serialize on the owner row. No HTTP transaction state is needed.
CREATE OR REPLACE FUNCTION ensure_seller_form(p_account UUID, p_org UUID, p_slug TEXT, p_can_create BOOLEAN, p_max_forms INTEGER)
RETURNS SETOF intake_links LANGUAGE plpgsql AS $$
DECLARE a accounts; f intake_links;
BEGIN
    SELECT * INTO a FROM accounts WHERE id = p_account FOR UPDATE;
    IF NOT FOUND OR a.role = 'banned' OR a.closure_status <> 'active' THEN RETURN; END IF;
    IF p_org IS NOT NULL AND NOT EXISTS (SELECT 1 FROM organization_members WHERE account_id = p_account AND organization_id = p_org) THEN RETURN; END IF;
    SELECT * INTO f FROM intake_links WHERE account_id = p_account AND organization_id IS NOT DISTINCT FROM p_org
        ORDER BY is_default DESC, created_at, id LIMIT 1;
    IF FOUND THEN
        IF NOT f.is_default THEN UPDATE intake_links SET is_default = TRUE, revision = revision + 1 WHERE id = f.id RETURNING * INTO f; END IF;
        RETURN NEXT f; RETURN;
    END IF;
    -- During expand, do not attempt a second workspace row under the old constraint.
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'intake_links'::regclass AND conname = 'intake_links_account_id_key')
        AND EXISTS (SELECT 1 FROM intake_links WHERE account_id = p_account) THEN RETURN; END IF;
    -- First-ever provisioning is allowed. Any additional workspace default uses
    -- the same operational eligibility and account-wide cap as explicit creation.
    -- Keep these decisions under the owner lock, including ensure/create races.
    IF EXISTS (SELECT 1 FROM intake_links WHERE account_id = p_account) THEN
        IF p_can_create IS DISTINCT FROM TRUE OR p_max_forms IS NULL OR p_max_forms <= 0 THEN RETURN; END IF;
        IF (SELECT COUNT(*) FROM intake_links WHERE account_id = p_account) >= p_max_forms THEN RETURN; END IF;
    END IF;
    IF (SELECT COUNT(*) FROM intake_links WHERE account_id = p_account AND organization_id IS NOT DISTINCT FROM p_org)
        >= seller_form_allowance(p_account, p_org) THEN RETURN; END IF;
    INSERT INTO intake_links(account_id, organization_id, scope_initialized, slug, is_default, is_referral_identity,
        collect_hoa_questions, collect_electric_meter_number)
    VALUES (p_account, p_org, TRUE, p_slug, TRUE, NOT EXISTS (SELECT 1 FROM intake_links WHERE account_id = p_account AND is_referral_identity),
        COALESCE(a.notification_preferences->'collect_hoa_questions', 'true'::jsonb) <> 'false'::jsonb,
        COALESCE(a.notification_preferences->'collect_electric_meter_number', 'true'::jsonb) <> 'false'::jsonb)
    RETURNING * INTO f;
    RETURN NEXT f;
END $$;

-- Old callers can read/repair existing defaults and initialize their first form.
-- They cannot bypass the additional-form rollout by using the legacy signature.
CREATE OR REPLACE FUNCTION ensure_seller_form(p_account UUID, p_org UUID, p_slug TEXT)
RETURNS SETOF intake_links LANGUAGE sql AS $$
    SELECT * FROM ensure_seller_form(p_account, p_org, p_slug, FALSE, NULL);
$$;

CREATE OR REPLACE FUNCTION save_seller_form(p_account UUID, p_org UUID, p_id UUID, p_revision INTEGER, p_config JSONB, p_slug TEXT, p_max_forms INTEGER, p_can_create BOOLEAN)
RETURNS SETOF intake_links LANGUAGE plpgsql AS $$
DECLARE a accounts; f intake_links;
BEGIN
    SELECT * INTO a FROM accounts WHERE id = p_account FOR UPDATE;
    IF NOT FOUND OR a.role = 'banned' OR a.closure_status <> 'active' THEN RETURN; END IF;
    IF p_org IS NOT NULL AND NOT EXISTS (SELECT 1 FROM organization_members WHERE account_id = p_account AND organization_id = p_org) THEN RETURN; END IF;
    IF p_id IS NULL THEN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'intake_links'::regclass AND conname = 'intake_links_account_id_key') THEN
            RAISE EXCEPTION 'Multiple forms are not enabled';
        END IF;
        IF p_can_create IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Additional forms are not enabled for this account yet' USING ERRCODE = 'SF403'; END IF;
        IF (SELECT COUNT(*) FROM intake_links WHERE account_id = p_account AND organization_id IS NOT DISTINCT FROM p_org)
            >= seller_form_allowance(p_account, p_org) THEN
            RAISE EXCEPTION 'Saved form allowance reached for this workspace' USING ERRCODE = 'SF402',
                DETAIL = json_build_object('allowance', seller_form_allowance(p_account, p_org), 'usage',
                    (SELECT COUNT(*) FROM intake_links WHERE account_id = p_account AND organization_id IS NOT DISTINCT FROM p_org))::text;
        END IF;
        IF p_max_forms IS NULL OR p_max_forms <= 0 THEN RAISE EXCEPTION 'Pilot technical cap not configured' USING ERRCODE = 'SF429'; END IF;
        IF (SELECT COUNT(*) FROM intake_links WHERE account_id = p_account) >= p_max_forms THEN
            RAISE EXCEPTION 'Form creation technical cap reached' USING ERRCODE = 'SF429';
        END IF;
        INSERT INTO intake_links(account_id, organization_id, scope_initialized, slug, is_default, is_referral_identity)
        VALUES (p_account, p_org, TRUE, p_slug,
            NOT EXISTS (SELECT 1 FROM intake_links WHERE account_id = p_account AND organization_id IS NOT DISTINCT FROM p_org),
            NOT EXISTS (SELECT 1 FROM intake_links WHERE account_id = p_account AND is_referral_identity)) RETURNING * INTO f;
    ELSE
        SELECT * INTO f FROM intake_links WHERE id = p_id AND account_id = p_account AND organization_id IS NOT DISTINCT FROM p_org FOR UPDATE;
        IF NOT FOUND THEN RETURN; END IF;
        IF f.revision <> p_revision THEN RAISE EXCEPTION 'Form changed; reload before saving' USING ERRCODE = 'SF409'; END IF;
    END IF;
    IF p_config->>'defaultBrandProfileId' IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM brand_profiles WHERE id = (p_config->>'defaultBrandProfileId')::uuid
        AND organization_id IS NOT DISTINCT FROM p_org AND (p_org IS NOT NULL OR account_id = p_account)
    ) THEN RAISE EXCEPTION 'Invalid Branding Profile'; END IF;
    UPDATE intake_links SET
        name = COALESCE(p_config->>'name', f.name),
        seller_intro = CASE WHEN p_config ? 'sellerIntro' THEN NULLIF(btrim(p_config->>'sellerIntro'), '') ELSE f.seller_intro END,
        slug = COALESCE(p_config->>'slug', f.slug),
        is_active = COALESCE((p_config->>'isActive')::boolean, f.is_active),
        default_brand_profile_id = CASE WHEN p_config ? 'defaultBrandProfileId' THEN (p_config->>'defaultBrandProfileId')::uuid ELSE f.default_brand_profile_id END,
        default_utility_categories = CASE WHEN p_config ? 'defaultUtilityCategories' THEN ARRAY(SELECT jsonb_array_elements_text(p_config->'defaultUtilityCategories')) ELSE f.default_utility_categories END,
        default_packet_mode = COALESCE(p_config->>'defaultPacketMode', f.default_packet_mode),
        advanced_modules = CASE WHEN p_config ? 'advancedModules' THEN ARRAY(SELECT jsonb_array_elements_text(p_config->'advancedModules')) ELSE f.advanced_modules END,
        advanced_module_exclusions = COALESCE(p_config->'advancedModuleExclusions', f.advanced_module_exclusions),
        collect_hoa_questions = COALESCE((p_config->>'collectHoaQuestions')::boolean, f.collect_hoa_questions),
        collect_electric_meter_number = COALESCE((p_config->>'collectElectricMeterNumber')::boolean, f.collect_electric_meter_number),
        revision = CASE WHEN p_id IS NULL THEN 1 ELSE f.revision + 1 END, updated_at = NOW()
    WHERE id = f.id RETURNING * INTO f;
    RETURN NEXT f;
END $$;

-- Compatible old callers may edit; allocation requires explicit operational eligibility.
CREATE OR REPLACE FUNCTION save_seller_form(p_account UUID, p_org UUID, p_id UUID, p_revision INTEGER, p_config JSONB, p_slug TEXT, p_max_forms INTEGER DEFAULT NULL)
RETURNS SETOF intake_links LANGUAGE sql AS $$
    SELECT * FROM save_seller_form(p_account, p_org, p_id, p_revision, p_config, p_slug, p_max_forms, FALSE);
$$;

CREATE OR REPLACE FUNCTION set_default_seller_form(p_account UUID, p_org UUID, p_id UUID)
RETURNS SETOF intake_links LANGUAGE plpgsql AS $$
BEGIN
    PERFORM 1 FROM accounts WHERE id = p_account AND role <> 'banned' AND closure_status = 'active' FOR UPDATE;
    IF NOT FOUND THEN RETURN; END IF;
    IF p_org IS NOT NULL AND NOT EXISTS (SELECT 1 FROM organization_members WHERE account_id = p_account AND organization_id = p_org) THEN RETURN; END IF;
    IF NOT EXISTS (SELECT 1 FROM intake_links WHERE id = p_id AND account_id = p_account AND organization_id IS NOT DISTINCT FROM p_org) THEN RETURN; END IF;
    UPDATE intake_links SET is_default = FALSE, revision = revision + 1, updated_at = NOW()
        WHERE account_id = p_account AND organization_id IS NOT DISTINCT FROM p_org AND is_default AND id <> p_id;
    RETURN QUERY UPDATE intake_links SET is_default = TRUE, revision = revision + 1, updated_at = NOW() WHERE id = p_id RETURNING *;
END $$;

-- Snapshot provenance is checked at INSERT, including edits racing the start route.
CREATE OR REPLACE FUNCTION validate_request_source_form() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE f intake_links;
BEGIN
    IF NEW.source_form_id IS NULL THEN RETURN NEW; END IF;
    -- Account -> form matches ensure/save/default and account closure. Take the
    -- account FK's key-share lock before the form so a writer cannot form a cycle.
    PERFORM 1 FROM accounts WHERE id = NEW.account_id AND role <> 'banned' AND closure_status = 'active' FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Form unavailable'; END IF;
    SELECT * INTO f FROM intake_links WHERE id = NEW.source_form_id FOR SHARE;
    IF NOT FOUND OR f.account_id <> NEW.account_id OR f.organization_id IS DISTINCT FROM NEW.organization_id THEN
        RAISE EXCEPTION 'Invalid request form';
    END IF;
    IF f.revision IS DISTINCT FROM NEW.source_form_revision THEN RAISE EXCEPTION 'Form changed; reload before starting' USING ERRCODE = 'SF409'; END IF;
    IF (NOT f.is_active AND NOT COALESCE(NEW.is_demo, FALSE)) OR NOT EXISTS (
        SELECT 1 FROM accounts WHERE id = f.account_id AND role <> 'banned' AND closure_status = 'active'
    ) OR (f.organization_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM organization_members WHERE account_id = f.account_id AND organization_id = f.organization_id
    )) THEN RAISE EXCEPTION 'Form unavailable'; END IF;
    NEW.collect_hoa_questions := COALESCE(NEW.collect_hoa_questions, f.collect_hoa_questions);
    NEW.collect_electric_meter_number := COALESCE(NEW.collect_electric_meter_number, f.collect_electric_meter_number);
    NEW.seller_intro := f.seller_intro;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validate_request_source_form ON requests;
CREATE TRIGGER validate_request_source_form BEFORE INSERT ON requests FOR EACH ROW EXECUTE FUNCTION validate_request_source_form();
COMMIT;
