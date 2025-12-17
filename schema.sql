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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Brand Profiles table
CREATE TABLE IF NOT EXISTS brand_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#10b981',
    secondary_color TEXT DEFAULT '#059669',
    contact_name TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    contact_website TEXT,
    disclaimer_text TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Requests table (utility sheet requests)
CREATE TABLE IF NOT EXISTS requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    brand_profile_id UUID REFERENCES brand_profiles(id) ON DELETE SET NULL,
    property_address TEXT NOT NULL,
    property_address_structured JSONB,
    seller_name TEXT,
    seller_email TEXT,
    seller_phone TEXT,
    closing_date DATE,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'in_progress', 'submitted')),
    public_token TEXT UNIQUE NOT NULL,
    utility_categories TEXT[] DEFAULT ARRAY['electric', 'gas', 'water', 'sewer', 'trash'],
    water_source TEXT CHECK (water_source IN ('city', 'well', 'not_sure')),
    sewer_type TEXT CHECK (sewer_type IN ('public', 'septic', 'not_sure')),
    heating_type TEXT CHECK (heating_type IN ('natural_gas', 'electric', 'propane', 'oil', 'not_sure')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

-- Utility Entries table (seller responses)
CREATE TABLE IF NOT EXISTS utility_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    entry_mode TEXT CHECK (entry_mode IN ('suggested_confirmed', 'search_selected', 'free_text', 'unknown', 'not_applicable')),
    display_name TEXT,
    raw_text TEXT,
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_requests_account_id ON requests(account_id);
CREATE INDEX IF NOT EXISTS idx_requests_public_token ON requests(public_token);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_utility_entries_request_id ON utility_entries(request_id);
CREATE INDEX IF NOT EXISTS idx_brand_profiles_account_id ON brand_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_request_id ON event_logs(request_id);

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

DROP TRIGGER IF EXISTS update_utility_entries_updated_at ON utility_entries;
CREATE TRIGGER update_utility_entries_updated_at
    BEFORE UPDATE ON utility_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
