-- Admin Dashboard Migration
-- Run this in your Neon SQL Editor to add admin functionality

-- Step 1: Add role column to accounts table
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' 
CHECK (role IN ('user', 'admin', 'banned'));

-- Step 2: Create admin audit logs table
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES accounts(id),
    target_user_id UUID REFERENCES accounts(id),
    action TEXT NOT NULL,
    metadata JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user_id ON admin_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON admin_audit_logs(created_at DESC);

-- Step 4: Set yourself as admin (replace with your email)
-- UPDATE accounts SET role = 'admin' WHERE email = 'your-email@example.com';
