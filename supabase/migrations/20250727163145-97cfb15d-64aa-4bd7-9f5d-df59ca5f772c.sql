
-- Step 1: Fix schema inconsistency by standardizing on client_workspace
-- Create the client_workspace schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS client_workspace;

-- Create the company_profiles table with proper structure
CREATE TABLE IF NOT EXISTS client_workspace.company_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL DEFAULT '',
  company_website TEXT,
  industry TEXT DEFAULT 'Technology/Software',
  company_size TEXT DEFAULT 'startup',
  contact_first_name TEXT DEFAULT '',
  contact_last_name TEXT DEFAULT '',
  contact_role TEXT DEFAULT '',
  contact_phone TEXT,
  company_country TEXT DEFAULT 'United States',
  company_city TEXT DEFAULT '',
  company_timezone TEXT DEFAULT 'UTC-05:00',
  billing_email TEXT,
  company_logo_url TEXT,
  onboarding_status TEXT DEFAULT 'incomplete',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on company_profiles
ALTER TABLE client_workspace.company_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage own company profile" ON client_workspace.company_profiles;

-- Create RLS policy for company_profiles
CREATE POLICY "Users can manage own company profile" 
ON client_workspace.company_profiles 
FOR ALL 
USING (auth_user_id = auth.uid());

-- Update the client account creation function to use client_workspace
CREATE OR REPLACE FUNCTION public.create_client_account_for_user(
  user_id_param UUID, 
  company_name_param TEXT DEFAULT 'My Company',
  first_name_param TEXT DEFAULT NULL,
  last_name_param TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace', 'auth'
AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = user_id_param;
  
  IF user_email IS NULL THEN
    RAISE EXCEPTION 'User not found with ID: %', user_id_param;
  END IF;
  
  -- Create account_types record first
  INSERT INTO public.account_types (auth_user_id, account_type)
  VALUES (user_id_param, 'client')
  ON CONFLICT (auth_user_id) DO UPDATE SET account_type = 'client';
  
  -- Create client workspace profile
  INSERT INTO client_workspace.company_profiles (
    auth_user_id, 
    company_name, 
    contact_first_name, 
    contact_last_name, 
    billing_email,
    onboarding_status
  )
  VALUES (
    user_id_param, 
    company_name_param,
    first_name_param,
    last_name_param, 
    user_email,
    'incomplete'
  )
  ON CONFLICT (auth_user_id) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    contact_first_name = EXCLUDED.contact_first_name,
    contact_last_name = EXCLUDED.contact_last_name,
    billing_email = EXCLUDED.billing_email,
    updated_at = NOW();
  
  -- Log the account creation
  INSERT INTO public.error_logs (
    error_type,
    error_message,
    context,
    user_id,
    metadata
  ) VALUES (
    'info',
    'Client account created successfully',
    'create_client_account_for_user',
    user_id_param,
    jsonb_build_object(
      'company_name', company_name_param,
      'method', 'rpc_function',
      'email', user_email
    )
  );
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error with more detail
    INSERT INTO public.error_logs (
      error_type,
      error_message,
      error_stack,
      context,
      user_id,
      metadata
    ) VALUES (
      'client_account_creation_error',
      SQLERRM,
      SQLSTATE,
      'create_client_account_for_user',
      user_id_param,
      jsonb_build_object(
        'company_name', company_name_param,
        'error_detail', SQLERRM,
        'sql_state', SQLSTATE,
        'email', user_email
      )
    );
    
    RAISE WARNING 'Failed to create client account for user %: %', user_id_param, SQLERRM;
    RETURN FALSE;
END;
$$;

-- Update the client account creation trigger to use client_workspace
CREATE OR REPLACE FUNCTION public.handle_client_account_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace', 'auth'
AS $$
BEGIN
  -- Check if this is a client signup
  IF (NEW.raw_user_meta_data->>'accountType' = 'client') OR 
     (NEW.raw_user_meta_data->>'account_type' = 'client') THEN
    
    -- Create account type record
    INSERT INTO public.account_types (auth_user_id, account_type)
    VALUES (NEW.id, 'client')
    ON CONFLICT (auth_user_id) DO UPDATE SET account_type = 'client';
    
    -- Insert company profile using client_workspace schema
    INSERT INTO client_workspace.company_profiles (
      auth_user_id,
      company_name,
      contact_first_name,
      contact_last_name,
      billing_email
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'companyName', ''),
      COALESCE(NEW.raw_user_meta_data->>'contactFirstName', ''),
      COALESCE(NEW.raw_user_meta_data->>'contactLastName', ''),
      NEW.email
    )
    ON CONFLICT (auth_user_id) DO UPDATE SET
      updated_at = NOW();
    
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    INSERT INTO public.error_logs (
      error_type,
      error_message,
      context,
      user_id,
      metadata
    ) VALUES (
      'client_account_creation_error',
      SQLERRM,
      'handle_client_account_creation',
      NEW.id,
      jsonb_build_object(
        'error_detail', SQLERRM,
        'sql_state', SQLSTATE
      )
    );
    RAISE WARNING 'Failed to create client profile: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Drop the old trigger if it exists and recreate it
DROP TRIGGER IF EXISTS on_auth_user_created_client ON auth.users;
CREATE TRIGGER on_auth_user_created_client
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_client_account_creation();

-- Add updated_at trigger for company_profiles
CREATE OR REPLACE FUNCTION client_workspace.update_company_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'client_workspace'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_company_profiles_updated_at ON client_workspace.company_profiles;
CREATE TRIGGER update_company_profiles_updated_at
  BEFORE UPDATE ON client_workspace.company_profiles
  FOR EACH ROW EXECUTE FUNCTION client_workspace.update_company_profiles_updated_at();
