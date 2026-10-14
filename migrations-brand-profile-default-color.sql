-- New default brand colors: the app's slate-blue primary instead of emerald,
-- which the design system reserves for success states.
-- Changes the brand_profiles column defaults only. The application already
-- passes both colors explicitly on every insert (lib/branding/deliverable.ts),
-- so these defaults are a backstop. No existing row is changed: profiles that
-- store the old '#10b981' / '#059669' keep them. Rerunnable, and safe to apply
-- before or after the application change. Applying this to any live database
-- requires owner authorization.
BEGIN;

ALTER TABLE brand_profiles ALTER COLUMN primary_color SET DEFAULT '#23588a';
ALTER TABLE brand_profiles ALTER COLUMN secondary_color SET DEFAULT '#0b4072';

COMMIT;
