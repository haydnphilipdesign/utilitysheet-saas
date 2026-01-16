-- Product Updates / Changelog
-- Generated: 2026-01-16

CREATE TABLE IF NOT EXISTS product_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('bugfix', 'feature', 'announcement')),
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES accounts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_updates_is_published ON product_updates(is_published);
CREATE INDEX IF NOT EXISTS idx_product_updates_published_at ON product_updates(published_at DESC);

DROP TRIGGER IF EXISTS update_product_updates_updated_at ON product_updates;
CREATE TRIGGER update_product_updates_updated_at
    BEFORE UPDATE ON product_updates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

