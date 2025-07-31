
-- First, create the client_workflow schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS client_workflow;

-- Create the clients table in the client_workflow schema
CREATE TABLE IF NOT EXISTS client_workflow.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  company_name TEXT,
  company_url TEXT,
  role TEXT,
  country TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on the clients table
ALTER TABLE client_workflow.clients ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for the clients table
CREATE POLICY "Clients can view their own records" 
  ON client_workflow.clients 
  FOR SELECT 
  USING (auth_user_id = auth.uid());

CREATE POLICY "Clients can insert their own records" 
  ON client_workflow.clients 
  FOR INSERT 
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Clients can update their own records" 
  ON client_workflow.clients 
  FOR UPDATE 
  USING (auth_user_id = auth.uid());

-- Create function to check if user is a client account
CREATE OR REPLACE FUNCTION public.is_client_account(user_id_param uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM client_workflow.clients 
    WHERE auth_user_id = user_id_param
  );
END;
$$;

-- Create function to ensure client account exists
CREATE OR REPLACE FUNCTION public.ensure_client_account_robust(
  user_id_param uuid,
  company_name_param text DEFAULT 'My Company',
  first_name_param text DEFAULT '',
  last_name_param text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email text;
  full_name_value text;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO user_email FROM auth.users WHERE id = user_id_param;
  
  IF user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Build full name
  full_name_value := TRIM(CONCAT(first_name_param, ' ', last_name_param));
  IF full_name_value = '' THEN
    full_name_value := NULL;
  END IF;
  
  -- Insert or update client record
  INSERT INTO client_workflow.clients (
    auth_user_id,
    email,
    full_name,
    company_name
  ) VALUES (
    user_id_param,
    user_email,
    full_name_value,
    company_name_param
  )
  ON CONFLICT (auth_user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, client_workflow.clients.full_name),
    company_name = COALESCE(EXCLUDED.company_name, client_workflow.clients.company_name),
    updated_at = now();
    
  RETURN jsonb_build_object('success', true, 'message', 'Client account ensured');
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
