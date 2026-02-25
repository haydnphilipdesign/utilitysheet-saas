-- Requests/intake links: dual-mode packet support
-- Generated: 2026-02-25

ALTER TABLE requests
ADD COLUMN IF NOT EXISTS packet_mode TEXT NOT NULL DEFAULT 'simple'
CHECK (packet_mode IN ('simple', 'advanced'));

ALTER TABLE requests
ADD COLUMN IF NOT EXISTS advanced_modules TEXT[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE requests
ADD COLUMN IF NOT EXISTS advanced_packet_data JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE intake_links
ADD COLUMN IF NOT EXISTS default_packet_mode TEXT NOT NULL DEFAULT 'simple'
CHECK (default_packet_mode IN ('simple', 'advanced'));

-- Keep canonical schema parity with runtime brand profile fields
ALTER TABLE brand_profiles
ADD COLUMN IF NOT EXISTS buyer_next_steps JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS next_steps_title TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS show_powered_by BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_generation_date BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS welcome_message TEXT DEFAULT NULL;

