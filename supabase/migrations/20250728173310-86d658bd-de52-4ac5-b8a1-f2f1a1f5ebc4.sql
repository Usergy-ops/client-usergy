
-- Phase 1: Database Schema Fixes

-- Add missing onboarding_status column to company_profiles
ALTER TABLE client_workspace.company_profiles 
ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'incomplete';

-- Add unique constraint on auth_user_id for proper ON CONFLICT handling
ALTER TABLE client_workspace.company_profiles 
ADD CONSTRAINT IF NOT EXISTS company_profiles_auth_user_id_unique 
UNIQUE (auth_user_id);

-- Drop existing Google OAuth trigger that's causing issues
DROP TRIGGER IF EXISTS on_google_oauth_client_signup ON auth.users;

-- Create improved Google OAuth trigger function
CREATE OR REPLACE FUNCTION public.handle_google_oauth_client_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace', 'auth'
AS $function$
DECLARE
  full_name TEXT;
  name_parts TEXT[];
  first_name TEXT;
  last_name TEXT;
  profile_exists BOOLEAN;
BEGIN
  -- Only process Google OAuth users
  IF NEW.raw_app_meta_data->>'provider' = 'google' THEN
    
    -- Log trigger execution
    INSERT INTO public.error_logs (
      error_type, error_message, context, user_id, metadata
    ) VALUES (
      'info', 'Google OAuth trigger executing', 'handle_google_oauth_client_signup',
      NEW.id, jsonb_build_object('email', NEW.email, 'provider', 'google')
    );
    
    -- Check if client profile already exists
    SELECT EXISTS(
      SELECT 1 FROM client_workspace.company_profiles 
      WHERE auth_user_id = NEW.id
    ) INTO profile_exists;
    
    -- Only create if profile doesn't exist
    IF NOT profile_exists THEN
      -- Extract name parts from Google metadata
      full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
      name_parts := string_to_array(full_name, ' ');
      first_name := COALESCE(name_parts[1], '');
      last_name := COALESCE(array_to_string(name_parts[2:], ' '), '');
      
      -- Create account type record
      INSERT INTO public.account_types (auth_user_id, account_type)
      VALUES (NEW.id, 'client')
      ON CONFLICT (auth_user_id, account_type) DO UPDATE SET account_type = 'client';
      
      -- Create client workspace profile with proper schema
      INSERT INTO client_workspace.company_profiles (
        auth_user_id, company_name, contact_first_name, contact_last_name, 
        billing_email, onboarding_status
      )
      VALUES (
        NEW.id, 'My Company', first_name, last_name, NEW.email, 'incomplete'
      )
      ON CONFLICT (auth_user_id) DO UPDATE SET
        company_name = COALESCE(EXCLUDED.company_name, company_profiles.company_name),
        contact_first_name = COALESCE(EXCLUDED.contact_first_name, company_profiles.contact_first_name),
        contact_last_name = COALESCE(EXCLUDED.contact_last_name, company_profiles.contact_last_name),
        updated_at = NOW();
      
      -- Log successful creation
      INSERT INTO public.error_logs (
        error_type, error_message, context, user_id, metadata
      ) VALUES (
        'info', 'Google OAuth client account created successfully', 'handle_google_oauth_client_signup',
        NEW.id, jsonb_build_object('email', NEW.email, 'first_name', first_name, 'last_name', last_name)
      );
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    INSERT INTO public.error_logs (
      error_type, error_message, context, user_id, metadata
    ) VALUES (
      'google_oauth_error', SQLERRM, 'handle_google_oauth_client_signup',
      NEW.id, jsonb_build_object('error_detail', SQLERRM, 'sql_state', SQLSTATE)
    );
    RETURN NEW;
END;
$function$;

-- Create the trigger
CREATE TRIGGER on_google_oauth_client_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_google_oauth_client_signup();

-- Update create_client_account_for_user function to handle schema properly
CREATE OR REPLACE FUNCTION public.create_client_account_for_user(
  user_id_param uuid, 
  company_name_param text DEFAULT 'My Company'::text, 
  first_name_param text DEFAULT NULL::text, 
  last_name_param text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace', 'auth'
AS $function$
DECLARE
  user_email TEXT;
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = user_id_param;
  
  IF user_email IS NULL THEN
    RAISE EXCEPTION 'User not found with ID: %', user_id_param;
  END IF;
  
  -- Create account_types record
  INSERT INTO public.account_types (auth_user_id, account_type)
  VALUES (user_id_param, 'client')
  ON CONFLICT (auth_user_id, account_type) DO UPDATE SET 
    created_at = COALESCE(account_types.created_at, NOW());
  
  -- Create client workspace profile with proper schema
  INSERT INTO client_workspace.company_profiles (
    auth_user_id, company_name, contact_first_name, contact_last_name, 
    billing_email, onboarding_status
  )
  VALUES (
    user_id_param, company_name_param, first_name_param, last_name_param, 
    user_email, 'incomplete'
  )
  ON CONFLICT (auth_user_id) DO UPDATE SET
    company_name = CASE 
      WHEN EXCLUDED.company_name IS NOT NULL AND EXCLUDED.company_name != '' 
      THEN EXCLUDED.company_name ELSE company_profiles.company_name END,
    contact_first_name = CASE 
      WHEN EXCLUDED.contact_first_name IS NOT NULL AND EXCLUDED.contact_first_name != '' 
      THEN EXCLUDED.contact_first_name ELSE company_profiles.contact_first_name END,
    contact_last_name = CASE 
      WHEN EXCLUDED.contact_last_name IS NOT NULL AND EXCLUDED.contact_last_name != '' 
      THEN EXCLUDED.contact_last_name ELSE company_profiles.contact_last_name END,
    billing_email = COALESCE(EXCLUDED.billing_email, company_profiles.billing_email),
    updated_at = NOW();
  
  -- Log successful creation
  INSERT INTO public.error_logs (
    error_type, error_message, context, user_id, metadata
  ) VALUES (
    'info', 'Client account created successfully', 'create_client_account_for_user',
    user_id_param, jsonb_build_object('company_name', company_name_param, 'email', user_email)
  );
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error with details
    INSERT INTO public.error_logs (
      error_type, error_message, error_stack, context, user_id, metadata
    ) VALUES (
      'client_account_creation_error', SQLERRM, SQLSTATE, 'create_client_account_for_user',
      user_id_param, jsonb_build_object('company_name', company_name_param, 'error_detail', SQLERRM)
    );
    RETURN FALSE;
END;
$function$;

-- Update force_create_client_account function
CREATE OR REPLACE FUNCTION public.force_create_client_account(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace', 'auth'
AS $function$
DECLARE
  user_email TEXT;
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = user_id_param;
  
  IF user_email IS NULL THEN
    RAISE EXCEPTION 'User not found with ID: %', user_id_param;
  END IF;
  
  -- Force create account_types record
  INSERT INTO public.account_types (auth_user_id, account_type)
  VALUES (user_id_param, 'client')
  ON CONFLICT (auth_user_id, account_type) DO UPDATE SET 
    created_at = COALESCE(account_types.created_at, NOW());
  
  -- Force create company profile with proper schema
  INSERT INTO client_workspace.company_profiles (
    auth_user_id, company_name, contact_first_name, contact_last_name, 
    billing_email, onboarding_status
  )
  VALUES (
    user_id_param, 'My Company', 'User', 'Name', user_email, 'incomplete'
  )
  ON CONFLICT (auth_user_id) DO UPDATE SET
    company_name = COALESCE(EXCLUDED.company_name, company_profiles.company_name),
    updated_at = NOW();
  
  -- Log forced creation
  INSERT INTO public.error_logs (
    error_type, error_message, context, user_id, metadata
  ) VALUES (
    'info', 'Client account force created', 'force_create_client_account',
    user_id_param, jsonb_build_object('email', user_email, 'method', 'force_create')
  );
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error
    INSERT INTO public.error_logs (
      error_type, error_message, error_stack, context, user_id, metadata
    ) VALUES (
      'force_create_error', SQLERRM, SQLSTATE, 'force_create_client_account',
      user_id_param, jsonb_build_object('error_detail', SQLERRM, 'email', user_email)
    );
    RETURN FALSE;
END;
$function$;
