-- UtilitySheet Migration: Separate seller write token from public read token
-- Run this in your Neon SQL Editor BEFORE deploying code that expects seller_token.

-- 1) Add seller_token column (nullable during backfill)
ALTER TABLE requests
ADD COLUMN IF NOT EXISTS seller_token TEXT;

-- 2) Backfill existing rows (preserve existing seller links)
UPDATE requests
SET seller_token = public_token
WHERE seller_token IS NULL;

-- 3) Enforce constraints
ALTER TABLE requests
ALTER COLUMN seller_token SET NOT NULL;

-- 4) Index for lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_requests_seller_token ON requests(seller_token);

