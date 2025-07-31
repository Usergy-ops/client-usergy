
-- Step 1: Update supabase/config.toml to expose client_workflow schema
-- This will be handled in the config file update

-- Step 2: Fix RLS policies for client_workflow.otp_verifications
-- First, let's create the table if it doesn't exist and ensure proper RLS setup
CREATE TABLE IF NOT EXISTS client_workflow.otp_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on the table
ALTER TABLE client_workflow.otp_verifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow OTP operations for edge functions" ON client_workflow.otp_verifications;
DROP POLICY IF EXISTS "Service role can manage OTP verifications" ON client_workflow.otp_verifications;

-- Create proper RLS policies for OTP operations
-- Allow service role (edge functions) to manage OTP records
CREATE POLICY "Service role can manage OTP verifications" 
ON client_workflow.otp_verifications 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Allow anonymous users to insert OTP records (for signup)
CREATE POLICY "Allow OTP creation for anonymous users" 
ON client_workflow.otp_verifications 
FOR INSERT 
TO anon 
WITH CHECK (true);

-- Allow anonymous users to select OTP records for verification
CREATE POLICY "Allow OTP verification for anonymous users" 
ON client_workflow.otp_verifications 
FOR SELECT 
TO anon 
USING (true);

-- Allow anonymous users to update OTP records (mark as verified)
CREATE POLICY "Allow OTP updates for anonymous users" 
ON client_workflow.otp_verifications 
FOR UPDATE 
TO anon 
USING (true) 
WITH CHECK (true);

-- Step 3: Ensure client_workflow.clients table has proper RLS
ALTER TABLE client_workflow.clients ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Service role can manage clients" ON client_workflow.clients;
DROP POLICY IF EXISTS "Users can view their own client record" ON client_workflow.clients;

-- Create proper policies for clients table
CREATE POLICY "Service role can manage clients" 
ON client_workflow.clients 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Allow authenticated users to view their own client record
CREATE POLICY "Users can view their own client record" 
ON client_workflow.clients 
FOR SELECT 
TO authenticated 
USING (auth_user_id = auth.uid());

-- Step 4: Fix account_types table policies to allow service role operations
-- The table already exists, just ensure service role can manage it
DROP POLICY IF EXISTS "Service role can manage account types enhanced" ON account_types;

CREATE POLICY "Service role can manage account types enhanced" 
ON account_types 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Step 5: Clean up any orphaned OTP records
DELETE FROM client_workflow.otp_verifications 
WHERE expires_at < now() - INTERVAL '1 hour';
