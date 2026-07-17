-- Intake links: reusable seller-form status, Branding Profile, and utility defaults
-- Generated: 2026-07-17

ALTER TABLE intake_links
ADD COLUMN IF NOT EXISTS default_brand_profile_id UUID REFERENCES brand_profiles(id) ON DELETE SET NULL;

ALTER TABLE intake_links
ADD COLUMN IF NOT EXISTS default_utility_categories TEXT[] NOT NULL DEFAULT ARRAY[
    'electric',
    'gas',
    'propane',
    'oil',
    'water',
    'sewer',
    'trash',
    'internet',
    'cable'
]::text[];
