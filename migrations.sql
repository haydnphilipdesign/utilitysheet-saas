-- UtilitySheet Database Migrations
-- Run this in your Neon SQL Editor to add missing columns for multitenancy support
-- Generated: 2025-12-19

-- =====================================================
-- STEP 1: Create organizations table if not exists
-- =====================================================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- STEP 2: Create organization_members table if not exists
-- =====================================================
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, account_id)
);

-- =====================================================
-- STEP 3: Add active_organization_id to accounts
-- =====================================================
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS active_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- =====================================================
-- STEP 4: Add organization_id to requests
-- =====================================================
ALTER TABLE requests 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- =====================================================
-- STEP 5: Add organization_id to brand_profiles
-- =====================================================
ALTER TABLE brand_profiles 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- =====================================================
-- STEP 6: Create indexes for new columns
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_requests_organization_id ON requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_brand_profiles_organization_id ON brand_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_account ON organization_members(account_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org ON organization_members(organization_id);

-- =====================================================
-- Verification: Check that columns exist
-- =====================================================
-- Run this to verify the migration worked:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'requests';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'brand_profiles';

-- =====================================================
-- STEP 7: Add Stripe subscription fields to accounts
-- Generated: 2025-12-19 (Billing Integration)
-- =====================================================
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'free' 
  CHECK (subscription_status IN ('free', 'pro', 'canceled'));

ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS subscription_id TEXT;

ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

-- Index for finding accounts by Stripe customer ID
CREATE INDEX IF NOT EXISTS idx_accounts_stripe_customer_id ON accounts(stripe_customer_id);
