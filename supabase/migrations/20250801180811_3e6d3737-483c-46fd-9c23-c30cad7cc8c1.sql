
-- Create the missing is_client_account function
CREATE OR REPLACE FUNCTION public.is_client_account(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Check if user has client account type
  RETURN EXISTS (
    SELECT 1 
    FROM public.account_types 
    WHERE auth_user_id = user_id_param 
    AND account_type = 'client'
  );
END;
$function$;

-- Create the client_workflow schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS client_workflow;

-- Create the client_workspace schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS client_workspace;

-- Create clients table in client_workflow schema
CREATE TABLE IF NOT EXISTS client_workflow.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  onboarding_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on clients table
ALTER TABLE client_workflow.clients ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for clients
CREATE POLICY "Users can manage their own client data" 
ON client_workflow.clients 
FOR ALL 
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

-- Create company_profiles table in client_workspace schema
CREATE TABLE IF NOT EXISTS client_workspace.company_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on company_profiles table
ALTER TABLE client_workspace.company_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for company_profiles
CREATE POLICY "Users can manage their own company profiles" 
ON client_workspace.company_profiles 
FOR ALL 
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

-- Create ensure_client_account function
CREATE OR REPLACE FUNCTION public.ensure_client_account(
  user_id_param UUID,
  company_name_param TEXT DEFAULT 'My Company',
  first_name_param TEXT DEFAULT '',
  last_name_param TEXT DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  user_email TEXT;
  full_name_value TEXT;
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
  
  -- Ensure account type is set to client
  INSERT INTO public.account_types (auth_user_id, account_type)
  VALUES (user_id_param, 'client')
  ON CONFLICT (auth_user_id) DO UPDATE SET
    account_type = 'client',
    created_at = CURRENT_TIMESTAMP;
    
  -- Insert or update client record
  INSERT INTO client_workflow.clients (
    auth_user_id,
    email,
    full_name,
    first_name,
    last_name,
    company_name
  ) VALUES (
    user_id_param,
    user_email,
    full_name_value,
    first_name_param,
    last_name_param,
    company_name_param
  )
  ON CONFLICT (auth_user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, client_workflow.clients.full_name),
    first_name = COALESCE(EXCLUDED.first_name, client_workflow.clients.first_name),
    last_name = COALESCE(EXCLUDED.last_name, client_workflow.clients.last_name),
    company_name = COALESCE(EXCLUDED.company_name, client_workflow.clients.company_name),
    updated_at = now();
    
  RETURN jsonb_build_object(
    'success', true, 
    'is_client', true,
    'message', 'Client account ensured'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;
