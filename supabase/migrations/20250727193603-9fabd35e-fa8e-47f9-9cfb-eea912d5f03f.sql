
-- Phase 1: Fix Database Architecture

-- First, create the client_workspace schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS client_workspace;

-- Create the company_profiles table in client_workspace schema
CREATE TABLE IF NOT EXISTS client_workspace.company_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID NOT NULL UNIQUE,
  company_name TEXT NOT NULL DEFAULT '',
  contact_first_name TEXT NOT NULL DEFAULT '',
  contact_last_name TEXT NOT NULL DEFAULT '',
  billing_email TEXT NOT NULL,
  onboarding_status TEXT NOT NULL DEFAULT 'incomplete',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on company_profiles
ALTER TABLE client_workspace.company_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for company_profiles
CREATE POLICY "Users can view their own company profile" 
ON client_workspace.company_profiles 
FOR SELECT 
USING (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own company profile" 
ON client_workspace.company_profiles 
FOR UPDATE 
USING (auth_user_id = auth.uid());

CREATE POLICY "Service role can manage company profiles" 
ON client_workspace.company_profiles 
FOR ALL 
USING (auth.role() = 'service_role');

-- Create the missing database triggers
CREATE OR REPLACE FUNCTION public.handle_client_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if this is a client account creation
  IF NEW.raw_user_meta_data->>'account_type' = 'client' THEN
    
    -- Create account_types record
    INSERT INTO public.account_types (auth_user_id, account_type)
    VALUES (NEW.id, 'client')
    ON CONFLICT (auth_user_id) DO UPDATE SET account_type = 'client';
    
    -- Create company profile
    INSERT INTO client_workspace.company_profiles (
      auth_user_id,
      company_name,
      contact_first_name,
      contact_last_name,
      billing_email,
      onboarding_status
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'companyName', ''),
      COALESCE(NEW.raw_user_meta_data->>'contactFirstName', ''),
      COALESCE(NEW.raw_user_meta_data->>'contactLastName', ''),
      NEW.email,
      'incomplete'
    )
    ON CONFLICT (auth_user_id) DO UPDATE SET
      company_name = COALESCE(EXCLUDED.company_name, company_profiles.company_name),
      contact_first_name = COALESCE(EXCLUDED.contact_first_name, company_profiles.contact_first_name),
      contact_last_name = COALESCE(EXCLUDED.contact_last_name, company_profiles.contact_last_name),
      billing_email = EXCLUDED.billing_email,
      updated_at = NOW();
    
    -- Log successful creation
    INSERT INTO public.error_logs (
      error_type,
      error_message,
      context,
      user_id,
      metadata
    ) VALUES (
      'info',
      'Client account created successfully',
      'handle_client_signup',
      NEW.id,
      jsonb_build_object(
        'email', NEW.email,
        'company_name', COALESCE(NEW.raw_user_meta_data->>'companyName', ''),
        'method', 'trigger'
      )
    );
    
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
      'client_signup_error',
      SQLERRM,
      'handle_client_signup',
      NEW.id,
      jsonb_build_object(
        'error_detail', SQLERRM,
        'sql_state', SQLSTATE,
        'email', NEW.email
      )
    );
    RAISE WARNING 'Failed to create client account for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_client_user_created ON auth.users;
CREATE TRIGGER on_client_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_client_signup();

-- Create function to fix existing users who might be missing account_types
CREATE OR REPLACE FUNCTION public.fix_existing_client_accounts()
RETURNS void AS $$
DECLARE
  user_record record;
BEGIN
  -- Find users who have client metadata but no account_types record
  FOR user_record IN 
    SELECT u.id, u.email, u.raw_user_meta_data
    FROM auth.users u
    LEFT JOIN public.account_types at ON u.id = at.auth_user_id
    WHERE u.raw_user_meta_data->>'account_type' = 'client'
    AND at.auth_user_id IS NULL
  LOOP
    -- Create account_types record
    INSERT INTO public.account_types (auth_user_id, account_type)
    VALUES (user_record.id, 'client')
    ON CONFLICT (auth_user_id) DO UPDATE SET account_type = 'client';
    
    -- Create company profile if missing
    INSERT INTO client_workspace.company_profiles (
      auth_user_id,
      company_name,
      contact_first_name,
      contact_last_name,
      billing_email,
      onboarding_status
    )
    VALUES (
      user_record.id,
      COALESCE(user_record.raw_user_meta_data->>'companyName', ''),
      COALESCE(user_record.raw_user_meta_data->>'contactFirstName', ''),
      COALESCE(user_record.raw_user_meta_data->>'contactLastName', ''),
      user_record.email,
      'incomplete'
    )
    ON CONFLICT (auth_user_id) DO NOTHING;
    
    -- Log the fix
    INSERT INTO public.error_logs (
      error_type,
      error_message,
      context,
      user_id,
      metadata
    ) VALUES (
      'info',
      'Fixed existing client account',
      'fix_existing_client_accounts',
      user_record.id,
      jsonb_build_object(
        'email', user_record.email,
        'method', 'data_fix'
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the fix for existing users
SELECT public.fix_existing_client_accounts();

-- Update updated_at trigger for company_profiles
CREATE OR REPLACE FUNCTION public.update_company_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_company_profiles_updated_at ON client_workspace.company_profiles;
CREATE TRIGGER update_company_profiles_updated_at
  BEFORE UPDATE ON client_workspace.company_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_company_profile_updated_at();
