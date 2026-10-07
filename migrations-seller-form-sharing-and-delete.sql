-- Shared seller forms and form delete.
-- See .ai/decisions/2026-10-07-shared-seller-forms.md (Amendment).
--
-- intake_links.account_id stays the creator and the owner of the link name.
-- shared_owner_account_id marks a form shared with its workspace and names the
-- member who receives requests from its public link; hand-over changes only
-- that column. deleted_at hides a form for good. Deleting releases the form's
-- link endings so another form under the same link name can take them; the row
-- stays so its flat link name and any referral code remain bound.
--
-- Follows migrations-seller-form-heading.sql (fifth in the seller-form chain).
-- It replaces initialize_seller_form_links, ensure_seller_form, save_seller_form,
-- set_default_seller_form and validate_request_source_form, so rerun it after
-- rerunning any earlier file.
-- Additive and rerunnable; changes no existing row. While no form is shared or
-- deleted every function behaves as before, so it is safe under the previously
-- deployed application and must be applied before the application that reads
-- the new columns. Applying this to any live database requires owner
-- authorization.
BEGIN;

ALTER TABLE intake_links
    ADD COLUMN IF NOT EXISTS shared_owner_account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT
        CONSTRAINT intake_links_shared_needs_workspace CHECK (shared_owner_account_id IS NULL OR organization_id IS NOT NULL),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
        CONSTRAINT intake_links_deleted_not_default CHECK (deleted_at IS NULL OR NOT is_default);
CREATE INDEX IF NOT EXISTS intake_links_shared_workspace
    ON intake_links(organization_id) WHERE shared_owner_account_id IS NOT NULL;

-- Same body as in migrations-seller-form-readable-endings.sql, except that a
-- deleted form is never given an ending.
CREATE OR REPLACE FUNCTION initialize_seller_form_links(p_account UUID, p_org UUID, p_form UUID, p_suffix TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE ns seller_form_link_namespaces; g RECORD; v_n INTEGER; v_suffix TEXT;
BEGIN
    SELECT * INTO ns FROM seller_form_link_namespaces
        WHERE account_id = p_account AND organization_id IS NOT DISTINCT FROM p_org;
    IF NOT FOUND THEN
        INSERT INTO seller_form_link_namespaces(account_id, organization_id, root_form_id)
            SELECT il.account_id, il.organization_id, il.id FROM intake_links il
            WHERE il.account_id = p_account AND il.organization_id IS NOT DISTINCT FROM p_org
            ORDER BY il.is_default DESC, il.created_at, il.id LIMIT 1
        RETURNING * INTO ns;
        IF ns.id IS NULL THEN RETURN; END IF;
    END IF;
    FOR g IN SELECT il.id FROM intake_links il
        WHERE il.account_id = p_account AND il.organization_id IS NOT DISTINCT FROM p_org
          AND il.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM seller_form_suffix_aliases x WHERE x.form_id = il.id AND x.is_current)
        ORDER BY il.created_at, il.id
    LOOP
        IF g.id = p_form AND p_suffix IS NOT NULL THEN
            IF EXISTS (SELECT 1 FROM seller_form_suffix_aliases x
                WHERE x.namespace_id = ns.id AND x.suffix = p_suffix AND x.form_id <> g.id) THEN
                RAISE EXCEPTION 'Link ending already published' USING ERRCODE = 'SF423';
            END IF;
            v_suffix := p_suffix;
        ELSE
            v_n := 1;
            LOOP
                v_suffix := 'form-' || v_n;
                EXIT WHEN NOT EXISTS (SELECT 1 FROM seller_form_suffix_aliases x
                    WHERE x.namespace_id = ns.id AND x.suffix = v_suffix AND x.form_id <> g.id);
                v_n := v_n + 1;
                IF v_n > 100000 THEN RAISE EXCEPTION 'Unable to generate a link ending'; END IF;
            END LOOP;
        END IF;
        INSERT INTO seller_form_suffix_aliases(namespace_id, suffix, form_id, is_current)
            VALUES (ns.id, v_suffix, g.id, TRUE)
            ON CONFLICT (namespace_id, suffix) DO UPDATE SET is_current = TRUE;
    END LOOP;
END $$;

-- Shared forms count against the workspace: ten per current member on Teams.
CREATE OR REPLACE FUNCTION seller_form_shared_allowance(p_org UUID)
RETURNS INTEGER LANGUAGE sql STABLE AS $$
    SELECT CASE WHEN o.subscription_status = 'team'
        THEN 10 * (SELECT COUNT(*) FROM organization_members m WHERE m.organization_id = o.id)::integer
        ELSE 0 END FROM organizations o WHERE o.id = p_org;
$$;

-- The creator may always change their form. A shared form may also be changed
-- by its current owner and by admins of its workspace. Callers check that the
-- actor is an active member first.
CREATE OR REPLACE FUNCTION seller_form_can_change(p_actor UUID, p_creator UUID, p_shared_owner UUID, p_org UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
    SELECT p_creator = p_actor OR (p_shared_owner IS NOT NULL AND (p_shared_owner = p_actor OR EXISTS (
        SELECT 1 FROM organization_members m
        WHERE m.organization_id = p_org AND m.account_id = p_actor AND m.role = 'admin')));
$$;

-- Same body as before; a deleted form is never chosen and neither a shared nor
-- a deleted form uses the creator's allowance.
CREATE OR REPLACE FUNCTION ensure_seller_form(p_account UUID, p_org UUID, p_slug TEXT, p_can_create BOOLEAN, p_max_forms INTEGER)
RETURNS SETOF intake_links LANGUAGE plpgsql AS $$
DECLARE a accounts; f intake_links;
BEGIN
    SELECT * INTO a FROM accounts WHERE id = p_account FOR UPDATE;
    IF NOT FOUND OR a.role = 'banned' OR a.closure_status <> 'active' THEN RETURN; END IF;
    IF p_org IS NOT NULL AND NOT EXISTS (SELECT 1 FROM organization_members WHERE account_id = p_account AND organization_id = p_org) THEN RETURN; END IF;
    SELECT * INTO f FROM intake_links WHERE account_id = p_account AND organization_id IS NOT DISTINCT FROM p_org AND deleted_at IS NULL
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
    IF (SELECT COUNT(*) FROM intake_links WHERE account_id = p_account AND organization_id IS NOT DISTINCT FROM p_org
            AND shared_owner_account_id IS NULL AND deleted_at IS NULL)
        >= seller_form_allowance(p_account, p_org) THEN RETURN; END IF;
    INSERT INTO intake_links(account_id, organization_id, scope_initialized, slug, is_default, is_referral_identity,
        collect_hoa_questions, collect_electric_meter_number)
    VALUES (p_account, p_org, TRUE, p_slug, TRUE, NOT EXISTS (SELECT 1 FROM intake_links WHERE account_id = p_account AND is_referral_identity),
        COALESCE(a.notification_preferences->'collect_hoa_questions', 'true'::jsonb) <> 'false'::jsonb,
        COALESCE(a.notification_preferences->'collect_electric_meter_number', 'true'::jsonb) <> 'false'::jsonb)
    RETURNING * INTO f;
    RETURN NEXT f;
END $$;

-- p_account is the person acting. Every form mutation locks the row of the
-- form's creator (the owner of its link names) and no other account row, so
-- two admins editing each other's forms cannot wait on one another.
CREATE OR REPLACE FUNCTION save_seller_form(p_account UUID, p_org UUID, p_id UUID, p_revision INTEGER, p_config JSONB, p_slug TEXT, p_max_forms INTEGER, p_can_create BOOLEAN)
RETURNS SETOF intake_links LANGUAGE plpgsql AS $$
DECLARE a accounts; f intake_links; ns seller_form_link_namespaces; v_creator UUID;
BEGIN
    IF p_id IS NULL THEN
        v_creator := p_account;
    ELSE
        SELECT account_id INTO v_creator FROM intake_links
            WHERE id = p_id AND organization_id IS NOT DISTINCT FROM p_org AND deleted_at IS NULL;
        IF NOT FOUND THEN RETURN; END IF;
    END IF;
    PERFORM 1 FROM accounts WHERE id = v_creator FOR UPDATE;
    SELECT * INTO a FROM accounts WHERE id = p_account;
    IF NOT FOUND OR a.role = 'banned' OR a.closure_status <> 'active' THEN RETURN; END IF;
    IF p_org IS NOT NULL AND NOT EXISTS (SELECT 1 FROM organization_members WHERE account_id = p_account AND organization_id = p_org) THEN RETURN; END IF;
    IF p_id IS NULL THEN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'intake_links'::regclass AND conname = 'intake_links_account_id_key') THEN
            RAISE EXCEPTION 'Multiple forms are not enabled';
        END IF;
        IF p_can_create IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Additional forms are not enabled for this account yet' USING ERRCODE = 'SF403'; END IF;
        IF (SELECT COUNT(*) FROM intake_links WHERE account_id = p_account AND organization_id IS NOT DISTINCT FROM p_org
                AND shared_owner_account_id IS NULL AND deleted_at IS NULL)
            >= seller_form_allowance(p_account, p_org) THEN
            RAISE EXCEPTION 'Saved form allowance reached for this workspace' USING ERRCODE = 'SF402',
                DETAIL = json_build_object('allowance', seller_form_allowance(p_account, p_org), 'usage',
                    (SELECT COUNT(*) FROM intake_links WHERE account_id = p_account AND organization_id IS NOT DISTINCT FROM p_org
                        AND shared_owner_account_id IS NULL AND deleted_at IS NULL))::text;
        END IF;
        IF p_max_forms IS NULL OR p_max_forms <= 0 THEN RAISE EXCEPTION 'Pilot technical cap not configured' USING ERRCODE = 'SF429'; END IF;
        IF (SELECT COUNT(*) FROM intake_links WHERE account_id = p_account) >= p_max_forms THEN
            RAISE EXCEPTION 'Form creation technical cap reached' USING ERRCODE = 'SF429';
        END IF;
        -- Hand the reviewed ending to the insert trigger.
        PERFORM set_config('seller_forms.requested_suffix', COALESCE(p_config->>'suffix', ''), TRUE);
        INSERT INTO intake_links(account_id, organization_id, scope_initialized, slug, is_default, is_referral_identity)
        VALUES (p_account, p_org, TRUE, p_slug,
            NOT EXISTS (SELECT 1 FROM intake_links WHERE account_id = p_account AND organization_id IS NOT DISTINCT FROM p_org),
            NOT EXISTS (SELECT 1 FROM intake_links WHERE account_id = p_account AND is_referral_identity)) RETURNING * INTO f;
        PERFORM set_config('seller_forms.requested_suffix', '', TRUE);
    ELSE
        SELECT * INTO f FROM intake_links
            WHERE id = p_id AND organization_id IS NOT DISTINCT FROM p_org AND deleted_at IS NULL FOR UPDATE;
        IF NOT FOUND OR NOT seller_form_can_change(p_account, f.account_id, f.shared_owner_account_id, p_org) THEN RETURN; END IF;
        IF f.revision <> p_revision THEN RAISE EXCEPTION 'Form changed; reload before saving' USING ERRCODE = 'SF409'; END IF;
        -- The link name belongs to the creator alone.
        IF f.account_id <> p_account AND p_config->>'slug' IS NOT NULL AND p_config->>'slug' <> f.slug THEN
            RAISE EXCEPTION 'Only the person who created this form can rename its link name' USING ERRCODE = 'SF411';
        END IF;
    END IF;
    IF p_config->>'defaultBrandProfileId' IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM brand_profiles WHERE id = (p_config->>'defaultBrandProfileId')::uuid
        AND organization_id IS NOT DISTINCT FROM p_org AND (p_org IS NOT NULL OR account_id = p_account)
    ) THEN RAISE EXCEPTION 'Invalid Branding Profile'; END IF;
    IF p_id IS NOT NULL AND p_config->>'suffix' IS NOT NULL THEN
        PERFORM initialize_seller_form_links(v_creator, p_org, NULL, NULL);
        SELECT * INTO ns FROM seller_form_link_namespaces
            WHERE account_id = v_creator AND organization_id IS NOT DISTINCT FROM p_org;
        IF NOT EXISTS (SELECT 1 FROM seller_form_suffix_aliases x
            WHERE x.form_id = f.id AND x.is_current AND x.suffix = p_config->>'suffix') THEN
            IF EXISTS (SELECT 1 FROM seller_form_suffix_aliases x
                WHERE x.namespace_id = ns.id AND x.suffix = p_config->>'suffix' AND x.form_id <> f.id) THEN
                RAISE EXCEPTION 'Link ending already published' USING ERRCODE = 'SF423';
            END IF;
            UPDATE seller_form_suffix_aliases SET is_current = FALSE WHERE form_id = f.id AND is_current;
            INSERT INTO seller_form_suffix_aliases(namespace_id, suffix, form_id, is_current)
                VALUES (ns.id, p_config->>'suffix', f.id, TRUE)
                ON CONFLICT (namespace_id, suffix) DO UPDATE SET is_current = TRUE;
        END IF;
    END IF;
    UPDATE intake_links SET
        name = COALESCE(p_config->>'name', f.name),
        seller_heading = CASE WHEN p_config ? 'sellerHeading' THEN NULLIF(btrim(p_config->>'sellerHeading'), '') ELSE f.seller_heading END,
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

-- Creator only, as before; a deleted form cannot become the default.
CREATE OR REPLACE FUNCTION set_default_seller_form(p_account UUID, p_org UUID, p_id UUID)
RETURNS SETOF intake_links LANGUAGE plpgsql AS $$
BEGIN
    PERFORM 1 FROM accounts WHERE id = p_account AND role <> 'banned' AND closure_status = 'active' FOR UPDATE;
    IF NOT FOUND THEN RETURN; END IF;
    IF p_org IS NOT NULL AND NOT EXISTS (SELECT 1 FROM organization_members WHERE account_id = p_account AND organization_id = p_org) THEN RETURN; END IF;
    IF NOT EXISTS (SELECT 1 FROM intake_links WHERE id = p_id AND account_id = p_account AND organization_id IS NOT DISTINCT FROM p_org
        AND deleted_at IS NULL) THEN RETURN; END IF;
    UPDATE intake_links SET is_default = FALSE, revision = revision + 1, updated_at = NOW()
        WHERE account_id = p_account AND organization_id IS NOT DISTINCT FROM p_org AND is_default AND id <> p_id;
    RETURN QUERY UPDATE intake_links SET is_default = TRUE, revision = revision + 1, updated_at = NOW() WHERE id = p_id RETURNING *;
END $$;

-- Share a form with its workspace, or take it back. The workspace row is locked
-- first (the same first lock as member removal) so concurrent shares by
-- different creators cannot pass the workspace allowance together.
CREATE OR REPLACE FUNCTION set_seller_form_shared(p_actor UUID, p_org UUID, p_id UUID, p_revision INTEGER, p_shared BOOLEAN)
RETURNS SETOF intake_links LANGUAGE plpgsql AS $$
DECLARE o organizations; f intake_links; v_creator UUID;
BEGIN
    IF p_org IS NULL OR p_shared IS NULL THEN RETURN; END IF;
    SELECT * INTO o FROM organizations WHERE id = p_org FOR UPDATE;
    IF NOT FOUND THEN RETURN; END IF;
    SELECT account_id INTO v_creator FROM intake_links WHERE id = p_id AND organization_id = p_org AND deleted_at IS NULL;
    IF NOT FOUND THEN RETURN; END IF;
    PERFORM 1 FROM accounts WHERE id = v_creator FOR UPDATE;
    IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = p_actor AND role <> 'banned' AND closure_status = 'active')
        OR NOT EXISTS (SELECT 1 FROM organization_members WHERE account_id = p_actor AND organization_id = p_org) THEN RETURN; END IF;
    SELECT * INTO f FROM intake_links WHERE id = p_id AND organization_id = p_org AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RETURN; END IF;
    IF f.revision <> p_revision THEN RAISE EXCEPTION 'Form changed; reload before saving' USING ERRCODE = 'SF409'; END IF;
    IF p_shared THEN
        IF f.shared_owner_account_id IS NOT NULL THEN RETURN NEXT f; RETURN; END IF;
        IF f.account_id <> p_actor THEN
            RAISE EXCEPTION 'Only the person who created a form can share it' USING ERRCODE = 'SF411';
        END IF;
        IF o.subscription_status IS DISTINCT FROM 'team' THEN
            RAISE EXCEPTION 'Sharing forms needs the Teams plan' USING ERRCODE = 'SF412';
        END IF;
        IF (SELECT COUNT(*) FROM intake_links WHERE organization_id = p_org AND shared_owner_account_id IS NOT NULL AND deleted_at IS NULL)
            >= seller_form_shared_allowance(p_org) THEN
            RAISE EXCEPTION 'Shared form allowance reached for this workspace' USING ERRCODE = 'SF413';
        END IF;
        UPDATE intake_links SET shared_owner_account_id = f.account_id, revision = revision + 1, updated_at = NOW()
            WHERE id = f.id RETURNING * INTO f;
    ELSE
        IF f.shared_owner_account_id IS NULL THEN RETURN NEXT f; RETURN; END IF;
        IF NOT seller_form_can_change(p_actor, f.account_id, f.shared_owner_account_id, p_org) THEN
            RAISE EXCEPTION 'Only the form''s creator or a workspace admin can stop sharing it' USING ERRCODE = 'SF411';
        END IF;
        -- It would become the personal form of someone outside the workspace.
        IF NOT EXISTS (SELECT 1 FROM organization_members WHERE account_id = f.account_id AND organization_id = p_org) THEN
            RAISE EXCEPTION 'The person who created this form has left the workspace' USING ERRCODE = 'SF414';
        END IF;
        IF (SELECT COUNT(*) FROM intake_links WHERE account_id = f.account_id AND organization_id = p_org
                AND shared_owner_account_id IS NULL AND deleted_at IS NULL)
            >= seller_form_allowance(f.account_id, p_org) THEN
            RAISE EXCEPTION 'The form''s creator has no room left for another personal form' USING ERRCODE = 'SF415';
        END IF;
        UPDATE intake_links SET shared_owner_account_id = NULL, revision = revision + 1, updated_at = NOW()
            WHERE id = f.id RETURNING * INTO f;
    END IF;
    RETURN NEXT f;
END $$;

-- Hides a form for good. Its link endings are released for reuse under the
-- same link name; the row stays so its flat link name and any referral code
-- remain bound, and requests created from it are untouched.
CREATE OR REPLACE FUNCTION delete_seller_form(p_actor UUID, p_org UUID, p_id UUID, p_revision INTEGER)
RETURNS SETOF intake_links LANGUAGE plpgsql AS $$
DECLARE f intake_links; v_creator UUID;
BEGIN
    SELECT account_id INTO v_creator FROM intake_links
        WHERE id = p_id AND organization_id IS NOT DISTINCT FROM p_org AND deleted_at IS NULL;
    IF NOT FOUND THEN RETURN; END IF;
    PERFORM 1 FROM accounts WHERE id = v_creator FOR UPDATE;
    IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = p_actor AND role <> 'banned' AND closure_status = 'active') THEN RETURN; END IF;
    IF p_org IS NOT NULL AND NOT EXISTS (SELECT 1 FROM organization_members WHERE account_id = p_actor AND organization_id = p_org) THEN RETURN; END IF;
    SELECT * INTO f FROM intake_links
        WHERE id = p_id AND organization_id IS NOT DISTINCT FROM p_org AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND OR NOT seller_form_can_change(p_actor, f.account_id, f.shared_owner_account_id, p_org) THEN RETURN; END IF;
    IF f.revision <> p_revision THEN RAISE EXCEPTION 'Form changed; reload before saving' USING ERRCODE = 'SF409'; END IF;
    IF f.is_default THEN
        RAISE EXCEPTION 'The default form cannot be deleted' USING ERRCODE = 'SF416';
    END IF;
    -- Release its endings so another form of the same link name can take them.
    DELETE FROM seller_form_suffix_aliases WHERE form_id = f.id;
    UPDATE intake_links SET deleted_at = NOW(), is_active = FALSE, shared_owner_account_id = NULL,
        revision = revision + 1, updated_at = NOW()
    WHERE id = f.id RETURNING * INTO f;
    RETURN NEXT f;
END $$;

-- A personal form still needs its creator to own the request and to be a
-- member. A shared form accepts a request from any current member and depends
-- on its current owner instead of its creator. A deleted form accepts nothing.
CREATE OR REPLACE FUNCTION validate_request_source_form() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE f intake_links; v_owner UUID;
BEGIN
    IF NEW.source_form_id IS NULL THEN RETURN NEW; END IF;
    -- Account -> form matches ensure/save/default and account closure. Take the
    -- account FK's key-share lock before the form so a writer cannot form a cycle.
    PERFORM 1 FROM accounts WHERE id = NEW.account_id AND role <> 'banned' AND closure_status = 'active' FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Form unavailable'; END IF;
    SELECT * INTO f FROM intake_links WHERE id = NEW.source_form_id FOR SHARE;
    IF NOT FOUND OR f.deleted_at IS NOT NULL OR f.organization_id IS DISTINCT FROM NEW.organization_id THEN
        RAISE EXCEPTION 'Invalid request form';
    END IF;
    IF f.shared_owner_account_id IS NULL THEN
        IF f.account_id <> NEW.account_id THEN RAISE EXCEPTION 'Invalid request form'; END IF;
    ELSIF NOT EXISTS (
        SELECT 1 FROM organization_members WHERE account_id = NEW.account_id AND organization_id = f.organization_id
    ) THEN RAISE EXCEPTION 'Invalid request form'; END IF;
    IF f.revision IS DISTINCT FROM NEW.source_form_revision THEN RAISE EXCEPTION 'Form changed; reload before starting' USING ERRCODE = 'SF409'; END IF;
    v_owner := COALESCE(f.shared_owner_account_id, f.account_id);
    IF (NOT f.is_active AND NOT COALESCE(NEW.is_demo, FALSE)) OR NOT EXISTS (
        SELECT 1 FROM accounts WHERE id = v_owner AND role <> 'banned' AND closure_status = 'active'
    ) OR (f.organization_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM organization_members WHERE account_id = v_owner AND organization_id = f.organization_id
    )) THEN RAISE EXCEPTION 'Form unavailable'; END IF;
    NEW.collect_hoa_questions := COALESCE(NEW.collect_hoa_questions, f.collect_hoa_questions);
    NEW.collect_electric_meter_number := COALESCE(NEW.collect_electric_meter_number, f.collect_electric_meter_number);
    NEW.seller_intro := f.seller_intro;
    RETURN NEW;
END $$;

COMMIT;
