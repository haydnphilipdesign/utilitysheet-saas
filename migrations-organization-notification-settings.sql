-- Workspace-level notification routing settings for organizations.
-- Backward compatible: existing rows default to '{}'::jsonb, which resolves to
-- routing disabled, preserving the current owner-only notification behavior.
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS notification_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
