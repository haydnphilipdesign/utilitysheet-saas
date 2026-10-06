-- Base link follows the default form: every form, including the one that owns
-- the base name, gets its own permanent ending, so the bare base link can open
-- whichever form is the default. Follows migrations-seller-form-base-links.sql.
-- Additive and rerunnable. Safe under the previously deployed application, which
-- never sends an ending for the base owner. Applying this to any live database
-- requires owner authorization. Apply before deploying code that relies on it.
--
-- Part 1: guards and writers.
BEGIN;

CREATE OR REPLACE FUNCTION guard_seller_form_suffix_alias() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ns seller_form_link_namespaces; f intake_links;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.namespace_id <> OLD.namespace_id OR NEW.suffix <> OLD.suffix OR NEW.form_id <> OLD.form_id THEN
            RAISE EXCEPTION 'Published link endings are permanent';
        END IF;
        RETURN NEW;
    END IF;
    SELECT * INTO ns FROM seller_form_link_namespaces WHERE id = NEW.namespace_id;
    SELECT * INTO f FROM intake_links WHERE id = NEW.form_id;
    IF ns.id IS NULL OR f.id IS NULL OR f.account_id <> ns.account_id
        OR f.organization_id IS DISTINCT FROM ns.organization_id THEN
        RAISE EXCEPTION 'Link ending must belong to a form of the same creator and workspace';
    END IF;
    RETURN NEW;
END $$;

-- Idempotent per creator/workspace. Callers hold the owner row lock (the
-- intake_links insert trigger, save_seller_form, or the backfill below).
-- Pins the base owner once (default, else oldest) and gives every form without
-- a current ending either the requested one or an opaque ID-derived one.
-- Internal form names are private and never become URL text here.
CREATE OR REPLACE FUNCTION initialize_seller_form_links(p_account UUID, p_org UUID, p_form UUID, p_suffix TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE ns seller_form_link_namespaces; g RECORD; v_hex TEXT; v_len INTEGER; v_suffix TEXT;
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
            v_hex := replace(g.id::text, '-', ''); v_len := 8;
            LOOP
                v_suffix := 'form-' || left(v_hex, v_len);
                EXIT WHEN NOT EXISTS (SELECT 1 FROM seller_form_suffix_aliases x
                    WHERE x.namespace_id = ns.id AND x.suffix = v_suffix AND x.form_id <> g.id);
                v_len := v_len + 4;
                IF v_len > 32 THEN RAISE EXCEPTION 'Unable to generate a link ending'; END IF;
            END LOOP;
        END IF;
        INSERT INTO seller_form_suffix_aliases(namespace_id, suffix, form_id, is_current)
            VALUES (ns.id, v_suffix, g.id, TRUE)
            ON CONFLICT (namespace_id, suffix) DO UPDATE SET is_current = TRUE;
    END LOOP;
END $$;

-- Same writer; the base owner may now rename its ending like any other form.
CREATE OR REPLACE FUNCTION save_seller_form(p_account UUID, p_org UUID, p_id UUID, p_revision INTEGER, p_config JSONB, p_slug TEXT, p_max_forms INTEGER, p_can_create BOOLEAN)
RETURNS SETOF intake_links LANGUAGE plpgsql AS $$
DECLARE a accounts; f intake_links; ns seller_form_link_namespaces;
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
        -- Hand the reviewed ending to the insert trigger.
        PERFORM set_config('seller_forms.requested_suffix', COALESCE(p_config->>'suffix', ''), TRUE);
        INSERT INTO intake_links(account_id, organization_id, scope_initialized, slug, is_default, is_referral_identity)
        VALUES (p_account, p_org, TRUE, p_slug,
            NOT EXISTS (SELECT 1 FROM intake_links WHERE account_id = p_account AND organization_id IS NOT DISTINCT FROM p_org),
            NOT EXISTS (SELECT 1 FROM intake_links WHERE account_id = p_account AND is_referral_identity)) RETURNING * INTO f;
        PERFORM set_config('seller_forms.requested_suffix', '', TRUE);
    ELSE
        SELECT * INTO f FROM intake_links WHERE id = p_id AND account_id = p_account AND organization_id IS NOT DISTINCT FROM p_org FOR UPDATE;
        IF NOT FOUND THEN RETURN; END IF;
        IF f.revision <> p_revision THEN RAISE EXCEPTION 'Form changed; reload before saving' USING ERRCODE = 'SF409'; END IF;
    END IF;
    IF p_config->>'defaultBrandProfileId' IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM brand_profiles WHERE id = (p_config->>'defaultBrandProfileId')::uuid
        AND organization_id IS NOT DISTINCT FROM p_org AND (p_org IS NOT NULL OR account_id = p_account)
    ) THEN RAISE EXCEPTION 'Invalid Branding Profile'; END IF;
    IF p_id IS NOT NULL AND p_config->>'suffix' IS NOT NULL THEN
        PERFORM initialize_seller_form_links(p_account, p_org, NULL, NULL);
        SELECT * INTO ns FROM seller_form_link_namespaces
            WHERE account_id = p_account AND organization_id IS NOT DISTINCT FROM p_org;
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
COMMIT;

-- Part 2: give each existing base owner an ending, owner row first (the same
-- order as every writer). Rerunning changes nothing.
BEGIN;
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT DISTINCT account_id FROM intake_links ORDER BY account_id LOOP
        PERFORM 1 FROM accounts WHERE id = r.account_id FOR UPDATE;
        PERFORM initialize_seller_form_links(s.account_id, s.organization_id, NULL, NULL)
            FROM (SELECT DISTINCT il.account_id, il.organization_id FROM intake_links il
                WHERE il.account_id = r.account_id) s;
    END LOOP;
    IF EXISTS (
        SELECT 1 FROM intake_links il WHERE NOT EXISTS (
            SELECT 1 FROM seller_form_link_namespaces n
            JOIN seller_form_suffix_aliases x ON x.namespace_id = n.id AND x.form_id = il.id AND x.is_current
            WHERE n.account_id = il.account_id AND n.organization_id IS NOT DISTINCT FROM il.organization_id)
    ) OR EXISTS (
        SELECT 1 FROM seller_form_suffix_aliases x
        JOIN seller_form_link_namespaces n ON n.id = x.namespace_id JOIN intake_links il ON il.id = x.form_id
        WHERE il.account_id <> n.account_id OR il.organization_id IS DISTINCT FROM n.organization_id
    ) THEN RAISE EXCEPTION 'Base link backfill left a form without its own ending'; END IF;
END $$;
COMMIT;
