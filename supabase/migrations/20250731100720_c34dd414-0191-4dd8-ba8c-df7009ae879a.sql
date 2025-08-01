
-- Create the client_workflow schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS client_workflow;

-- Create the clients table
CREATE TABLE client_workflow.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  company_name TEXT,
  company_url TEXT,
  role TEXT,
  country TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create the OTP verifications table
CREATE TABLE client_workflow.otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on both tables
ALTER TABLE client_workflow.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_workflow.otp_verifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for clients table
CREATE POLICY "Users can view their own client record" 
ON client_workflow.clients 
FOR SELECT 
USING (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own client record" 
ON client_workflow.clients 
FOR UPDATE 
USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert their own client record" 
ON client_workflow.clients 
FOR INSERT 
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Service role can manage all client records" 
ON client_workflow.clients 
FOR ALL 
USING (auth.role() = 'service_role');

-- RLS policies for otp_verifications table
CREATE POLICY "Users can view OTP for their email" 
ON client_workflow.otp_verifications 
FOR SELECT 
USING (email IN (
  SELECT email FROM auth.users WHERE id = auth.uid()
));

CREATE POLICY "Users can insert OTP for their email" 
ON client_workflow.otp_verifications 
FOR INSERT 
WITH CHECK (email IN (
  SELECT email FROM auth.users WHERE id = auth.uid()
));

CREATE POLICY "Users can update OTP for their email" 
ON client_workflow.otp_verifications 
FOR UPDATE 
USING (email IN (
  SELECT email FROM auth.users WHERE id = auth.uid()
));

CREATE POLICY "Service role can manage all OTP records" 
ON client_workflow.otp_verifications 
FOR ALL 
USING (auth.role() = 'service_role');

-- Create necessary indexes
CREATE INDEX idx_clients_auth_user_id ON client_workflow.clients(auth_user_id);
CREATE INDEX idx_clients_email ON client_workflow.clients(email);
CREATE INDEX idx_otp_email ON client_workflow.otp_verifications(email);
CREATE INDEX idx_otp_code ON client_workflow.otp_verifications(otp_code);
CREATE INDEX idx_otp_expires_at ON client_workflow.otp_verifications(expires_at);

-- Create trigger to update the updated_at column
CREATE OR REPLACE FUNCTION client_workflow.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_clients_updated_at 
    BEFORE UPDATE ON client_workflow.clients 
    FOR EACH ROW 
    EXECUTE FUNCTION client_workflow.update_updated_at_column();
