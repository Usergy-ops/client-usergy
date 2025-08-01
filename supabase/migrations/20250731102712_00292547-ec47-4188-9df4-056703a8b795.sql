
-- Create client_workspace schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS client_workspace;

-- Create company_profiles table in client_workspace schema
CREATE TABLE IF NOT EXISTS client_workspace.company_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID NOT NULL UNIQUE,
  company_name TEXT,
  company_website TEXT,
  industry TEXT,
  company_size TEXT,
  contact_role TEXT,
  contact_phone TEXT,
  company_country TEXT,
  company_city TEXT,
  company_timezone TEXT,
  company_logo_url TEXT,
  onboarding_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on the company_profiles table
ALTER TABLE client_workspace.company_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for company_profiles
CREATE POLICY "Users can view their own company profile" 
  ON client_workspace.company_profiles 
  FOR SELECT 
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can insert their own company profile" 
  ON client_workspace.company_profiles 
  FOR INSERT 
  WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "Users can update their own company profile" 
  ON client_workspace.company_profiles 
  FOR UPDATE 
  USING (auth.uid() = auth_user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION client_workspace.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_company_profiles_updated_at 
  BEFORE UPDATE ON client_workspace.company_profiles 
  FOR EACH ROW EXECUTE FUNCTION client_workspace.update_updated_at_column();

-- Insert default company profile for existing client accounts
INSERT INTO client_workspace.company_profiles (auth_user_id, onboarding_status)
SELECT cw.auth_user_id, 'pending'
FROM client_workflow.clients cw
LEFT JOIN client_workspace.company_profiles cp ON cw.auth_user_id = cp.auth_user_id
WHERE cp.auth_user_id IS NULL
ON CONFLICT (auth_user_id) DO NOTHING;
