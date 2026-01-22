-- Teams (Multi-Seat) + Organization Billing
-- Generated: 2026-01-22

-- =====================================================
-- STEP 1: Add Stripe subscription fields to organizations
-- =====================================================
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'free'
  CHECK (subscription_status IN ('free', 'team', 'canceled'));

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS subscription_id TEXT;

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS seat_quantity INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer_id ON organizations(stripe_customer_id);

-- =====================================================
-- STEP 2: Organization invitations
-- =====================================================
CREATE TABLE IF NOT EXISTS organization_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    token TEXT UNIQUE NOT NULL,
    invited_by_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_invites_org_id ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_token ON organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_org_invites_expires_at ON organization_invitations(expires_at);

DROP TRIGGER IF EXISTS update_org_invites_updated_at ON organization_invitations;
CREATE TRIGGER update_org_invites_updated_at
    BEFORE UPDATE ON organization_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

