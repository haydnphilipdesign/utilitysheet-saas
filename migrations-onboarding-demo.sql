-- Add is_demo column to requests table for demo requests that don't count against usage limits
ALTER TABLE requests ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;

-- Create index for efficient filtering of demo requests
CREATE INDEX IF NOT EXISTS idx_requests_is_demo ON requests(is_demo);
