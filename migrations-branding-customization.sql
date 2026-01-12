-- Migration: Add advanced branding customization columns
-- Run this on your Neon database

-- Add new columns to brand_profiles table
ALTER TABLE brand_profiles
ADD COLUMN IF NOT EXISTS buyer_next_steps JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS next_steps_title TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS show_powered_by BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_generation_date BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS welcome_message TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN brand_profiles.buyer_next_steps IS 'Custom buyer next steps as JSON array of strings. NULL uses default steps.';
COMMENT ON COLUMN brand_profiles.next_steps_title IS 'Custom title for the Buyer Next Steps section. NULL uses "Buyer Next Steps".';
COMMENT ON COLUMN brand_profiles.show_powered_by IS 'Whether to show "Powered by utilitysheet.com" in footer.';
COMMENT ON COLUMN brand_profiles.show_generation_date IS 'Whether to show the "Generated on..." date on info sheets.';
COMMENT ON COLUMN brand_profiles.welcome_message IS 'Optional welcome/intro message shown above the utility table.';
