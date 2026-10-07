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
    subscription_cancel_at TIMESTAMPTZ, -- When a plan set to cancel ends; NULL when it renews
    subscription_trial_ends_at TIMESTAMPTZ, -- When a free trial ends; NULL when not in a trial
    onboarding_completed_at TIMESTAMPTZ,
    notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    closure_status TEXT NOT NULL DEFAULT 'active' CONSTRAINT accounts_closure_status_check CHECK (closure_status IN ('active', 'closing', 'closed')),
    closure_requested_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
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
    subscription_cancel_at TIMESTAMPTZ, -- When a plan set to cancel ends; NULL when it renews
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
    collect_hoa_questions BOOLEAN,
    collect_electric_meter_number BOOLEAN,
    water_source TEXT CHECK (water_source IN ('city', 'well', 'hoa', 'not_sure')),
    sewer_type TEXT CHECK (sewer_type IN ('public', 'septic', 'hoa', 'not_sure')),
    heating_type TEXT CHECK (heating_type IN ('natural_gas', 'electric', 'propane', 'oil', 'not_sure')),
    has_hoa TEXT CHECK (has_hoa IN ('yes', 'no', 'not_sure')),
    hoa_name TEXT,
    hoa_management_company TEXT,
    hoa_management_contact TEXT,
    hoa_management_phone TEXT,
    hoa_management_email TEXT,
    hoa_dues_amount TEXT,
    hoa_dues_frequency TEXT CHECK (hoa_dues_frequency IN ('monthly', 'quarterly', 'yearly')),
    hoa_portal_or_payment TEXT,
    is_demo BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    metered_at TIMESTAMPTZ,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    locked_reason TEXT,
    locked_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    -- Seller editing session; each reopen or close-without-changes adds 1.
    seller_edit_version INTEGER NOT NULL DEFAULT 0,
    -- Retry key of the accepted submission in the current session.
    seller_submission_key TEXT
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
    name TEXT NOT NULL DEFAULT 'My seller form' CHECK (length(btrim(name)) BETWEEN 1 AND 80),
    seller_intro TEXT CHECK (length(seller_intro) <= 500),
    -- Heading on the first screen of the reusable link. See migrations-seller-form-heading.sql.
    seller_heading TEXT CHECK (length(seller_heading) <= 80),
    organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
    scope_initialized BOOLEAN NOT NULL DEFAULT FALSE,
    is_default BOOLEAN NOT NULL DEFAULT TRUE,
    is_referral_identity BOOLEAN NOT NULL DEFAULT TRUE,
    collect_hoa_questions BOOLEAN NOT NULL DEFAULT TRUE,
    collect_electric_meter_number BOOLEAN NOT NULL DEFAULT TRUE,
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0)
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

-- Stored customer feedback and its Admin review state. See migrations-feedback-submissions.sql.
-- `message` is customer free text: never copy it into logs, analytics, audit metadata or AI calls.
CREATE TABLE IF NOT EXISTS feedback_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    category TEXT NOT NULL DEFAULT 'general'
        CHECK (category IN ('bug', 'idea', 'question', 'general')),
    message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
    page_path TEXT CHECK (page_path IS NULL OR char_length(page_path) <= 300),
    viewport TEXT CHECK (viewport IS NULL OR char_length(viewport) <= 20),
    user_agent TEXT CHECK (user_agent IS NULL OR char_length(user_agent) <= 400),
    email_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (email_status IN ('pending', 'sent', 'failed')),
    status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'reviewed', 'resolved')),
    note TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
    version INT NOT NULL DEFAULT 1,
    updated_by UUID REFERENCES accounts(id) ON DELETE SET NULL,
    status_changed_at TIMESTAMPTZ,
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

-- Self-serve account closure progress. See migrations-account-closure.sql.
CREATE TABLE IF NOT EXISTS account_closures (
    account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    step TEXT NOT NULL DEFAULT 'requested'
        CHECK (step IN ('requested', 'billing_canceled', 'data_removed', 'assets_removed', 'auth_deleted', 'completed')),
    transfers JSONB NOT NULL DEFAULT '{}'::jsonb,
    notify_email TEXT,
    pending_blob_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    attempt_count INT NOT NULL DEFAULT 0,
    last_error_code TEXT CHECK (last_error_code IS NULL OR char_length(last_error_code) <= 80),
    lease_until TIMESTAMPTZ,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
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
    status TEXT NOT NULL DEFAULT 'earned' CONSTRAINT referral_credits_status_check CHECK (status IN ('earned', 'applied', 'forfeited')),
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
CREATE INDEX IF NOT EXISTS idx_feedback_submissions_created_at
    ON feedback_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_submissions_status_created_at
    ON feedback_submissions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_submissions_account_created_at
    ON feedback_submissions(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_utility_entries_request_id ON utility_entries(request_id);
CREATE INDEX IF NOT EXISTS idx_brand_profiles_account_id ON brand_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_stripe_customer_id ON accounts(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_accounts_created_at_desc ON accounts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_role_plan_created_at_desc ON accounts(role, subscription_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer_id ON organizations(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_request_id ON event_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_account_security_events_account_created ON account_security_events(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_closure_status ON accounts(closure_status) WHERE closure_status <> 'active';
CREATE INDEX IF NOT EXISTS idx_account_closures_pending ON account_closures(updated_at) WHERE step <> 'completed';
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

-- Saved seller forms: final schema (account uniqueness removed in enable migration).
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

-- Shared base links. See migrations-seller-form-base-links.sql,
-- migrations-seller-form-default-base-link.sql and
-- migrations-seller-form-readable-endings.sql (apply in that order).
-- The root form is pinned once and only owns the base name: its flat slug and
-- every entry it owns in intake_link_aliases are the base aliases. The bare
-- base link opens the workspace's default form, not necessarily the root.
CREATE TABLE IF NOT EXISTS seller_form_link_namespaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
    root_form_id UUID NOT NULL UNIQUE REFERENCES intake_links(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS seller_form_link_namespaces_personal
    ON seller_form_link_namespaces(account_id) WHERE organization_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS seller_form_link_namespaces_workspace
    ON seller_form_link_namespaces(account_id, organization_id) WHERE organization_id IS NOT NULL;

-- Every published ending stays reserved to its form inside the namespace.
CREATE TABLE IF NOT EXISTS seller_form_suffix_aliases (
    namespace_id UUID NOT NULL REFERENCES seller_form_link_namespaces(id) ON DELETE CASCADE,
    suffix TEXT NOT NULL CHECK (suffix ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(suffix) BETWEEN 3 AND 60),
    form_id UUID NOT NULL REFERENCES intake_links(id) ON DELETE CASCADE,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (namespace_id, suffix)
);
CREATE UNIQUE INDEX IF NOT EXISTS seller_form_suffix_aliases_current
    ON seller_form_suffix_aliases(form_id) WHERE is_current;
CREATE INDEX IF NOT EXISTS seller_form_suffix_aliases_form ON seller_form_suffix_aliases(form_id);

-- Foreign keys do not prove owner/scope; these guards do, and keep identity permanent.
CREATE OR REPLACE FUNCTION guard_seller_form_link_namespace() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE f intake_links;
BEGIN
    IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'Seller form base identity is permanent'; END IF;
    SELECT * INTO f FROM intake_links WHERE id = NEW.root_form_id;
    IF NOT FOUND OR f.account_id <> NEW.account_id OR f.organization_id IS DISTINCT FROM NEW.organization_id THEN
        RAISE EXCEPTION 'Seller form base must belong to its creator and workspace';
    END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_seller_form_link_namespace ON seller_form_link_namespaces;
CREATE TRIGGER guard_seller_form_link_namespace BEFORE INSERT OR UPDATE ON seller_form_link_namespaces
    FOR EACH ROW EXECUTE FUNCTION guard_seller_form_link_namespace();

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
DROP TRIGGER IF EXISTS guard_seller_form_suffix_alias ON seller_form_suffix_aliases;
CREATE TRIGGER guard_seller_form_suffix_alias BEFORE INSERT OR UPDATE ON seller_form_suffix_aliases
    FOR EACH ROW EXECUTE FUNCTION guard_seller_form_suffix_alias();

-- Idempotent per creator/workspace. Callers hold the owner row lock (the
-- intake_links insert trigger, save_seller_form, or the backfill below).
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

-- Covers every allocating path, including ensure, create, duplicate, the
-- compatibility overloads and old insert writers. The BEFORE INSERT trigger
-- already holds the owner row lock.
CREATE OR REPLACE FUNCTION initialize_seller_form_link() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM initialize_seller_form_links(NEW.account_id, NEW.organization_id, NEW.id,
        NULLIF(current_setting('seller_forms.requested_suffix', TRUE), ''));
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS initialize_seller_form_link ON intake_links;
CREATE TRIGGER initialize_seller_form_link AFTER INSERT ON intake_links
    FOR EACH ROW EXECUTE FUNCTION initialize_seller_form_link();

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

-- Accepts an optional "suffix" key for the form's link ending and "sellerHeading".
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

-- Existing forms get their pinned base and endings; rerunning changes nothing.
DO $$ BEGIN
    PERFORM initialize_seller_form_links(s.account_id, s.organization_id, NULL, NULL)
        FROM (SELECT DISTINCT account_id, organization_id FROM intake_links) s;
END $$;

-- Durable seller reminder operations. See migrations-reminder-operations.sql.
CREATE TABLE IF NOT EXISTS reminder_operations (
    -- Supplied by the caller and reused on retry. Also the provider idempotency key.
    id UUID PRIMARY KEY,
    -- Reminders have no meaning without their request; removing it removes these rows.
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL DEFAULT 'seller_reminder' CHECK (purpose IN ('seller_reminder')),
    actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'agent')),
    actor_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    reason TEXT CHECK (reason IS NULL OR char_length(reason) <= 500),
    recipient_email TEXT NOT NULL CHECK (char_length(recipient_email) <= 254),
    -- SHA-256 of the exact rendered payload. A retry must reproduce it.
    payload_fingerprint TEXT NOT NULL CHECK (payload_fingerprint ~ '^[a-f0-9]{64}$'),
    state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'accepted', 'failed', 'unknown')),
    provider_message_id TEXT CHECK (provider_message_id IS NULL OR char_length(provider_message_id) <= 200),
    failure_code TEXT CHECK (failure_code IS NULL OR char_length(failure_code) <= 80),
    attempt_count INT NOT NULL DEFAULT 1,
    -- Provider delivery evidence (see migrations-operational-events.sql). NULL means unknown.
    delivery_status TEXT CHECK (delivery_status IS NULL OR delivery_status IN ('delivered', 'delayed', 'bounced', 'complained', 'failed')),
    delivery_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    finalized_at TIMESTAMPTZ
);

-- At most one in-flight reminder per request, enforced by the database.
CREATE UNIQUE INDEX IF NOT EXISTS reminder_operations_one_pending
    ON reminder_operations(request_id, purpose) WHERE state = 'pending';
CREATE INDEX IF NOT EXISTS idx_reminder_operations_request_created
    ON reminder_operations(request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminder_operations_provider_message
    ON reminder_operations(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reminder_operations_unresolved
    ON reminder_operations(updated_at) WHERE state IN ('pending', 'unknown');

-- Operational observations, job runs and alert state. See migrations-operational-events.sql.
CREATE TABLE IF NOT EXISTS operational_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN ('email', 'pdf', 'billing_webhook')),
    code TEXT NOT NULL CHECK (char_length(code) BETWEEN 1 AND 80),
    outcome TEXT NOT NULL CHECK (outcome IN ('failure', 'success')),
    severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
    -- Stable grouping key for an incident, for example 'pdf:generation_failed'.
    fingerprint TEXT NOT NULL CHECK (char_length(fingerprint) BETWEEN 1 AND 160),
    -- References survive deletion of the customer record as NULL; history never blocks account closure.
    request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    -- Stripe event ID or Resend webhook message ID. Deduplicates provider retries.
    provider_event_id TEXT CHECK (provider_event_id IS NULL OR char_length(provider_event_id) <= 200),
    correlation_id TEXT CHECK (correlation_id IS NULL OR char_length(correlation_id) <= 200),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Provider redeliveries of the same event bump this instead of adding rows.
    attempts INT NOT NULL DEFAULT 1,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS operational_events_provider_dedupe
    ON operational_events(category, provider_event_id, outcome) WHERE provider_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_operational_events_occurred ON operational_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_operational_events_fingerprint ON operational_events(fingerprint, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_operational_events_category_outcome
    ON operational_events(category, outcome, occurred_at DESC);

-- One row per scheduled job execution. Summary holds counts only.
CREATE TABLE IF NOT EXISTS job_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name TEXT NOT NULL CHECK (char_length(job_name) BETWEEN 1 AND 80),
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'failed')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    duration_ms INT,
    summary JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_job_runs_name_started ON job_runs(job_name, started_at DESC);

-- Notification state per alert condition, so an unchanged state is never re-sent.
CREATE TABLE IF NOT EXISTS ops_alert_state (
    alert_key TEXT PRIMARY KEY CHECK (char_length(alert_key) BETWEEN 1 AND 120),
    status TEXT NOT NULL CHECK (status IN ('firing', 'ok')),
    episode_started_at TIMESTAMPTZ,
    last_notified_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin triage state. See migrations-admin-triage.sql.
CREATE TABLE IF NOT EXISTS admin_triage_items (
    source_key TEXT PRIMARY KEY CHECK (char_length(source_key) BETWEEN 3 AND 200),
    kind TEXT NOT NULL CHECK (kind IN ('service', 'follow_up')),
    state TEXT NOT NULL CHECK (state IN ('open', 'acknowledged', 'snoozed', 'resolved')),
    snoozed_until TIMESTAMPTZ,
    -- Private internal note. Plain text, never included in alerts or external messages.
    note TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
    -- Incremented on every change; a write must name the version it read.
    version INT NOT NULL DEFAULT 1,
    updated_by UUID REFERENCES accounts(id) ON DELETE SET NULL,
    state_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (state <> 'snoozed' OR snoozed_until IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_admin_triage_items_state ON admin_triage_items(state, updated_at DESC);
