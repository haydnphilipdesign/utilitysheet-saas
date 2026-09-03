-- UtilitySheet Database Schema for Neon
-- Run this in your Neon SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Accounts table (for agents/TCs)
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id TEXT UNIQUE, -- Links to Stack Auth user
    email TEXT NOT NULL,
    full_name TEXT,
    company_name TEXT,
    phone TEXT,
    active_organization_id UUID, -- References organizations(id) later
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'banned')),
    stripe_customer_id TEXT,
    subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'pro', 'canceled')),
    subscription_id TEXT,
    subscription_ends_at TIMESTAMPTZ,
    onboarding_completed_at TIMESTAMPTZ,
    notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    stripe_customer_id TEXT,
    subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'team', 'canceled')),
    subscription_id TEXT,
    subscription_ends_at TIMESTAMPTZ,
    seat_quantity INT NOT NULL DEFAULT 0,
    notification_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Keep the active workspace pointer safe when an organization is removed.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'accounts_active_organization_id_fkey'
    ) THEN
        ALTER TABLE accounts
            ADD CONSTRAINT accounts_active_organization_id_fkey
            FOREIGN KEY (active_organization_id)
            REFERENCES organizations(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- Organization Members table
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, account_id)
);

-- Organization Invitations table (for email invites / join links)
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

CREATE TABLE IF NOT EXISTS brand_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#10b981',
    secondary_color TEXT DEFAULT '#059669',
    contact_name TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    contact_website TEXT,
    disclaimer_text TEXT,
    company_name TEXT DEFAULT NULL,
    professional_title TEXT DEFAULT NULL,
    license_number TEXT DEFAULT NULL,
    license_state TEXT DEFAULT NULL,
    compliance_line TEXT DEFAULT NULL,
    message_templates JSONB DEFAULT '{}'::jsonb,
    is_default BOOLEAN DEFAULT FALSE,
    buyer_next_steps JSONB DEFAULT NULL,
    next_steps_title TEXT DEFAULT NULL,
    show_powered_by BOOLEAN DEFAULT TRUE,
    show_generation_date BOOLEAN DEFAULT TRUE,
    welcome_message TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    brand_profile_id UUID REFERENCES brand_profiles(id) ON DELETE SET NULL,
    property_address TEXT NOT NULL,
    property_address_structured JSONB,
    seller_name TEXT,
    seller_email TEXT,
    seller_phone TEXT,
    closing_date DATE,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'in_progress', 'submitted')),
    packet_mode TEXT NOT NULL DEFAULT 'simple' CHECK (packet_mode IN ('simple', 'advanced')),
    advanced_modules TEXT[] NOT NULL DEFAULT '{}'::text[],
    advanced_module_exclusions JSONB NOT NULL DEFAULT '{}'::jsonb,
    advanced_packet_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    public_token TEXT UNIQUE NOT NULL,
    seller_token TEXT UNIQUE NOT NULL,
    utility_categories TEXT[] DEFAULT ARRAY['electric', 'gas', 'water', 'sewer', 'trash'],
    water_source TEXT CHECK (water_source IN ('city', 'well', 'hoa', 'not_sure')),
    sewer_type TEXT CHECK (sewer_type IN ('public', 'septic', 'hoa', 'not_sure')),
    heating_type TEXT CHECK (heating_type IN ('natural_gas', 'electric', 'propane', 'oil', 'not_sure')),
    is_demo BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    metered_at TIMESTAMPTZ,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    locked_reason TEXT,
    locked_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS intake_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    slug TEXT UNIQUE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    default_brand_profile_id UUID REFERENCES brand_profiles(id) ON DELETE SET NULL,
    default_utility_categories TEXT[] NOT NULL DEFAULT ARRAY['electric', 'gas', 'propane', 'oil', 'water', 'sewer', 'trash', 'internet', 'cable']::text[],
    default_packet_mode TEXT NOT NULL DEFAULT 'simple' CHECK (default_packet_mode IN ('simple', 'advanced')),
    advanced_modules TEXT[] NOT NULL DEFAULT '{}'::text[],
    advanced_module_exclusions JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id)
);

CREATE TABLE IF NOT EXISTS question_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    requested_text TEXT NOT NULL,
    context TEXT NOT NULL CHECK (context IN ('settings', 'request_creation')),
    packet_mode TEXT CHECK (packet_mode IN ('simple', 'advanced')),
    status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'reviewed', 'planned', 'declined')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Utility Entries table (seller responses)
CREATE TABLE IF NOT EXISTS utility_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    entry_mode TEXT CHECK (entry_mode IN ('suggested_confirmed', 'search_selected', 'free_text', 'unknown', 'not_applicable')),
    display_name TEXT,
    raw_text TEXT,
    meter_number TEXT,
    extra JSONB NOT NULL DEFAULT '{}'::jsonb,
    canonical_id TEXT,
    contact_phone TEXT,
    contact_url TEXT,
    confidence_score NUMERIC(3,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event Logs table (for activity tracking)
CREATE TABLE IF NOT EXISTS event_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_data JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI suggestion telemetry. Stores redacted run/item metadata only.
CREATE TABLE IF NOT EXISTS ai_generation_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    feature TEXT NOT NULL CHECK (feature IN ('provider_suggestions', 'provider_search')),
    category TEXT,
    provider TEXT NOT NULL DEFAULT 'gemini',
    model TEXT,
    prompt_version TEXT NOT NULL,
    served_pipeline TEXT,
    source TEXT,
    status TEXT NOT NULL CHECK (status IN ('success', 'fallback', 'error', 'parse_error', 'quality_rejected')),
    reason_code TEXT,
    upstream_reason_code TEXT,
    latency_ms INTEGER,
    attempt_count INTEGER,
    locality_state TEXT,
    locality_zip3 TEXT,
    locality_city TEXT,
    suggestion_count INTEGER NOT NULL DEFAULT 0,
    cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_suggestion_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES ai_generation_runs(id) ON DELETE CASCADE,
    request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
    category TEXT,
    rank INTEGER NOT NULL,
    display_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    canonical_id TEXT,
    confidence NUMERIC(3,2),
    source TEXT,
    contact_present BOOLEAN NOT NULL DEFAULT FALSE,
    selected_by_seller BOOLEAN,
    final_entry_mode TEXT,
    final_provider_name TEXT,
    final_canonical_id TEXT,
    final_confidence_score NUMERIC(3,2),
    selected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin Audit Logs table (for tracking admin actions)
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES accounts(id),
    target_user_id UUID REFERENCES accounts(id),
    action TEXT NOT NULL,
    metadata JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Self-service account security events. Metadata must remain free of passwords,
-- auth tokens, capability tokens, raw IP addresses, and user-agent strings.
CREATE TABLE IF NOT EXISTS account_security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (char_length(action) BETWEEN 1 AND 80),
    status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failure')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Product updates / changelog (shown on user dashboard)
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

CREATE TABLE IF NOT EXISTS activation_outreach_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    auth_user_id TEXT,
    email TEXT NOT NULL,
    campaign TEXT NOT NULL DEFAULT 'activation_reengagement',
    stage TEXT NOT NULL CHECK (stage IN ('after_15m', 'after_1d')),
    status TEXT NOT NULL CHECK (status IN ('sent', 'skipped', 'failed')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id, campaign, stage)
);

CREATE TABLE IF NOT EXISTS growth_attributions (
    account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    source TEXT,
    medium TEXT,
    campaign TEXT,
    content TEXT,
    referral_code TEXT,
    landing_path TEXT NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (char_length(source) <= 100),
    CHECK (char_length(medium) <= 100),
    CHECK (char_length(campaign) <= 100),
    CHECK (char_length(content) <= 100),
    CHECK (char_length(referral_code) <= 60),
    CHECK (char_length(landing_path) <= 200)
);

CREATE TABLE IF NOT EXISTS referral_credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_account_id UUID NOT NULL REFERENCES accounts(id),
    referred_account_id UUID NOT NULL REFERENCES accounts(id) UNIQUE,
    amount_cents INT NOT NULL DEFAULT 900,
    status TEXT NOT NULL DEFAULT 'earned' CHECK (status IN ('earned', 'applied')),
    stripe_balance_transaction_id TEXT,
    earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS growth_referral_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'click')),
    surface TEXT NOT NULL DEFAULT 'packet_share_page',
    referral_code TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (char_length(surface) <= 40),
    CHECK (char_length(referral_code) <= 60)
);

CREATE TABLE IF NOT EXISTS testimonial_outreach_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    subject TEXT NOT NULL,
    resend_email_id TEXT,
    sent_by_admin_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'dry_run')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_requests_account_id ON requests(account_id);
CREATE INDEX IF NOT EXISTS idx_requests_public_token ON requests(public_token);
CREATE INDEX IF NOT EXISTS idx_requests_seller_token ON requests(seller_token);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_metered_at ON requests(metered_at);
CREATE INDEX IF NOT EXISTS idx_requests_is_locked ON requests(is_locked);
CREATE INDEX IF NOT EXISTS idx_requests_deleted_at ON requests(deleted_at);
CREATE INDEX IF NOT EXISTS idx_question_requests_created_at
    ON question_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_requests_account_created_at
    ON question_requests(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_utility_entries_request_id ON utility_entries(request_id);
CREATE INDEX IF NOT EXISTS idx_brand_profiles_account_id ON brand_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_stripe_customer_id ON accounts(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_accounts_created_at_desc ON accounts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_role_plan_created_at_desc ON accounts(role, subscription_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer_id ON organizations(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_request_id ON event_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_account_security_events_account_created ON account_security_events(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_generation_runs_request_created ON ai_generation_runs(request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_generation_runs_feature_category_created ON ai_generation_runs(feature, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_generation_runs_status_created ON ai_generation_runs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_suggestion_items_request_category_name ON ai_suggestion_items(request_id, category, normalized_name);
CREATE INDEX IF NOT EXISTS idx_ai_suggestion_items_run_rank ON ai_suggestion_items(run_id, rank);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user_id ON admin_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_testimonial_outreach_logs_user_sent_at ON testimonial_outreach_logs(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_testimonial_outreach_logs_admin_sent_at ON testimonial_outreach_logs(sent_by_admin_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_updates_is_published ON product_updates(is_published);
CREATE INDEX IF NOT EXISTS idx_product_updates_published_at ON product_updates(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_invites_org_id ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_token ON organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_org_invites_expires_at ON organization_invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_activation_outreach_logs_account_campaign_stage ON activation_outreach_logs(account_id, campaign, stage);
CREATE INDEX IF NOT EXISTS idx_activation_outreach_logs_sent_at ON activation_outreach_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_attributions_source ON growth_attributions(source, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_attributions_referral_code ON growth_attributions(referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_referral_credits_referrer_account_id ON referral_credits(referrer_account_id);
CREATE INDEX IF NOT EXISTS idx_referral_credits_earned ON referral_credits(referrer_account_id, earned_at) WHERE status = 'earned';
CREATE INDEX IF NOT EXISTS idx_growth_referral_events_type_time ON growth_referral_events(event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_referral_events_referral_code ON growth_referral_events(referral_code) WHERE referral_code IS NOT NULL;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_brand_profiles_updated_at ON brand_profiles;
CREATE TRIGGER update_brand_profiles_updated_at
    BEFORE UPDATE ON brand_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_requests_updated_at ON requests;
CREATE TRIGGER update_requests_updated_at
    BEFORE UPDATE ON requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_intake_links_updated_at ON intake_links;
CREATE TRIGGER update_intake_links_updated_at
    BEFORE UPDATE ON intake_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_utility_entries_updated_at ON utility_entries;
CREATE TRIGGER update_utility_entries_updated_at
    BEFORE UPDATE ON utility_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_updates_updated_at ON product_updates;
CREATE TRIGGER update_product_updates_updated_at
    BEFORE UPDATE ON product_updates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_org_invites_updated_at ON organization_invitations;
CREATE TRIGGER update_org_invites_updated_at
    BEFORE UPDATE ON organization_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
