-- UtilitySheet Migration: Align water/sewer enums with seller form options
-- Run this in your Neon SQL Editor BEFORE deploying code that submits `water_source`/`sewer_type` values.

-- Water source: allow HOA/Condo ("hoa")
ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_water_source_check;
ALTER TABLE requests
ADD CONSTRAINT requests_water_source_check
CHECK (water_source IN ('city', 'well', 'hoa', 'not_sure'));

-- Sewer type: allow HOA/Condo ("hoa")
ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_sewer_type_check;
ALTER TABLE requests
ADD CONSTRAINT requests_sewer_type_check
CHECK (sewer_type IN ('public', 'septic', 'hoa', 'not_sure'));

