
-- Create client_workflow schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS client_workflow;

-- Create OTP verifications table
CREATE TABLE IF NOT EXISTS client_workflow.otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create clients table
CREATE TABLE IF NOT EXISTS client_workflow.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT NULL,
  company_name TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on both tables
ALTER TABLE client_workflow.otp_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_workflow.clients ENABLE ROW LEVEL SECURITY;

-- RLS policies for otp_verifications (service role only)
CREATE POLICY "Service role can manage OTP verifications" 
ON client_workflow.otp_verifications 
FOR ALL 
USING (auth.role() = 'service_role');

-- RLS policies for clients (users can view their own record)
CREATE POLICY "Users can view their own client record" 
ON client_workflow.clients 
FOR SELECT 
USING (auth_user_id = auth.uid());

CREATE POLICY "Service role can manage client records" 
ON client_workflow.clients 
FOR ALL 
USING (auth.role() = 'service_role');

-- Create the trigger function
CREATE OR REPLACE FUNCTION client_workflow.handle_new_client()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if account_type is client
  IF EXISTS (
    SELECT 1 FROM public.account_types 
    WHERE auth_user_id = NEW.id AND account_type = 'client'
  ) THEN
    -- Create client record if not exists
    INSERT INTO client_workflow.clients (auth_user_id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (auth_user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing client-related triggers first
DROP TRIGGER IF EXISTS on_client_signup ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_account_type_assignment_trigger ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_unified_trigger ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_profile_creation_trigger ON auth.users;
DROP TRIGGER IF EXISTS handle_unified_user_signup_trigger ON auth.users;

-- Create the single new trigger
CREATE TRIGGER on_client_signup
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION client_workflow.handle_new_client();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_otp_verifications_email ON client_workflow.otp_verifications(email);
CREATE INDEX IF NOT EXISTS idx_otp_verifications_expires_at ON client_workflow.otp_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_clients_auth_user_id ON client_workflow.clients(auth_user_id);
