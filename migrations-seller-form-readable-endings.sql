-- Readable automatic link endings: forms that are not given an ending get the
-- lowest free "form-N" in their workspace instead of an ID-derived code, and
-- existing automatic code endings that nobody renamed switch to that form too.
-- The old code endings stay reserved and keep opening the same form.
-- Follows migrations-seller-form-default-base-link.sql. Additive and
-- rerunnable. Changes no form, flat alias or request row. Applying this to any
-- live database requires owner authorization.
--
-- Part 1: generator.
BEGIN;

-- Idempotent per creator/workspace. Callers hold the owner row lock (the
-- intake_links insert trigger, save_seller_form, or a backfill).
-- Pins the base owner once (default, else oldest) and gives every form without
-- a current ending either the requested one or the lowest free "form-N".
-- Internal form names are private and never become URL text here.
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
COMMIT;

-- Part 2: replace current automatic code endings, owner row first (the same
-- order as every writer). An ending counts as automatic only when it is exactly
-- "form-" plus the leading hex digits of its own form ID. Form revisions are
-- left alone: no form configuration changes.
BEGIN;
DO $$
DECLARE r RECORD; g RECORD; v_n INTEGER; v_suffix TEXT;
BEGIN
    FOR r IN SELECT DISTINCT account_id FROM seller_form_link_namespaces ORDER BY account_id LOOP
        PERFORM 1 FROM accounts WHERE id = r.account_id FOR UPDATE;
        FOR g IN SELECT x.namespace_id, x.form_id FROM seller_form_suffix_aliases x
            JOIN seller_form_link_namespaces n ON n.id = x.namespace_id
            JOIN intake_links il ON il.id = x.form_id
            WHERE n.account_id = r.account_id AND x.is_current AND length(x.suffix) >= 13
              AND x.suffix = 'form-' || left(replace(il.id::text, '-', ''), length(x.suffix) - 5)
            ORDER BY x.namespace_id, il.created_at, il.id
        LOOP
            v_n := 1;
            LOOP
                v_suffix := 'form-' || v_n;
                EXIT WHEN NOT EXISTS (SELECT 1 FROM seller_form_suffix_aliases x
                    WHERE x.namespace_id = g.namespace_id AND x.suffix = v_suffix AND x.form_id <> g.form_id);
                v_n := v_n + 1;
                IF v_n > 100000 THEN RAISE EXCEPTION 'Unable to generate a link ending'; END IF;
            END LOOP;
            UPDATE seller_form_suffix_aliases SET is_current = FALSE WHERE form_id = g.form_id AND is_current;
            INSERT INTO seller_form_suffix_aliases(namespace_id, suffix, form_id, is_current)
                VALUES (g.namespace_id, v_suffix, g.form_id, TRUE)
                ON CONFLICT (namespace_id, suffix) DO UPDATE SET is_current = TRUE;
        END LOOP;
    END LOOP;
    IF EXISTS (
        SELECT 1 FROM intake_links il WHERE (SELECT count(*) FROM seller_form_suffix_aliases x
            WHERE x.form_id = il.id AND x.is_current) <> 1
    ) THEN RAISE EXCEPTION 'Readable ending backfill left a form without exactly one current ending'; END IF;
END $$;
COMMIT;
