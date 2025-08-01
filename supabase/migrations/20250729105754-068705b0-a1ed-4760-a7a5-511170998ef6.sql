
-- Phase 1: Remove all conflicting triggers and create one unified trigger
-- First, drop all existing triggers on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_client_creation_trigger ON auth.users;
DROP TRIGGER IF EXISTS handle_google_oauth_client_signup_trigger ON auth.users;

-- Drop the associated functions as they're no longer needed
DROP FUNCTION IF EXISTS public.handle_new_user_unified();
DROP FUNCTION IF EXISTS public.handle_new_user_client_creation();
DROP FUNCTION IF EXISTS public.handle_google_oauth_client_signup();
DROP FUNCTION IF EXISTS public.handle_new_user_secure();

-- Create a single, robust trigger function
CREATE OR REPLACE FUNCTION public.handle_client_user_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace', 'auth'
AS $function$
DECLARE
  full_name text;
  name_parts text[];
  first_name text := '';
  last_name text := '';
  company_name text := 'My Company';
BEGIN
  -- Log trigger execution
  INSERT INTO public.error_logs (
    error_type,
    error_message,
    context,
    user_id,
    metadata
  ) VALUES (
    'info',
    'Client user creation trigger fired',
    'handle_client_user_creation',
    NEW.id,
    jsonb_build_object(
      'email', NEW.email,
      'provider', NEW.raw_app_meta_data->>'provider',
      'account_type', NEW.raw_user_meta_data->>'account_type',
      'company_name', NEW.raw_user_meta_data->>'companyName'
    )
  );

  -- Extract name information from various possible fields
  full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    ''
  );
  
  first_name := COALESCE(
    NEW.raw_user_meta_data->>'contactFirstName',
    NEW.raw_user_meta_data->>'first_name',
    ''
  );
  
  last_name := COALESCE(
    NEW.raw_user_meta_data->>'contactLastName',
    NEW.raw_user_meta_data->>'last_name',
    ''
  );
  
  -- Parse full name if first/last names are empty
  IF (first_name = '' OR last_name = '') AND full_name != '' THEN
    name_parts := string_to_array(full_name, ' ');
    IF first_name = '' THEN
      first_name := COALESCE(name_parts[1], '');
    END IF;
    IF last_name = '' THEN
      last_name := COALESCE(array_to_string(name_parts[2:], ' '), '');
    END IF;
  END IF;
  
  -- Extract company name
  company_name := COALESCE(
    NEW.raw_user_meta_data->>'companyName,
    NEW.raw_user_meta_data->>'company_name',
    'My Company'
  );

  -- Create client account using the robust function
  PERFORM public.ensure_client_account_robust(
    NEW.id,
    company_name,
    first_name,
    last_name
  );
  
  -- Log successful completion
  INSERT INTO public.error_logs (
    error_type,
    error_message,
    context,
    user_id,
    metadata
  ) VALUES (
    'info',
    'Client account creation completed successfully',
    'handle_client_user_creation',
    NEW.id,
    jsonb_build_object(
      'email', NEW.email,
      'company_name', company_name,
      'first_name', first_name,
      'last_name', last_name
    )
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but never block user creation
    INSERT INTO public.error_logs (
      error_type,
      error_message,
      error_stack,
      context,
      user_id,
      metadata
    ) VALUES (
      'client_account_creation_trigger_error',
      SQLERRM,
      SQLSTATE,
      'handle_client_user_creation',
      NEW.id,
      jsonb_build_object(
        'error_detail', SQLERRM,
        'sql_state', SQLSTATE,
        'email', NEW.email,
        'company_name', company_name,
        'first_name', first_name,
        'last_name', last_name
      )
    );
    
    RAISE WARNING 'Client account creation failed for user %: %', NEW.id, SQLERRM;
    RETURN NEW; -- Always return NEW to not block user creation
END;
$function$;

-- Create the single unified trigger
CREATE TRIGGER handle_client_user_creation_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_client_user_creation();

-- Fix the company_profiles table reference issue (it should be in public schema, not client_workspace)
-- Check if we need to create the company_profiles table in public schema
DO $$
BEGIN
  -- Create company_profiles table in public schema if it doesn't exist
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'company_profiles') THEN
    CREATE TABLE public.company_profiles (
      id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      auth_user_id uuid NOT NULL UNIQUE,
      company_name text NOT NULL DEFAULT 'My Company',
      contact_first_name text DEFAULT '',
      contact_last_name text DEFAULT '',
      billing_email text NOT NULL,
      contact_email text,
      onboarding_status text DEFAULT 'incomplete',
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now(),
      CONSTRAINT company_profiles_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE
    );

    -- Enable RLS
    ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;

    -- Create RLS policies
    CREATE POLICY "Users can view their own company profile"
      ON public.company_profiles FOR SELECT
      USING (auth_user_id = auth.uid());

    CREATE POLICY "Users can update their own company profile"
      ON public.company_profiles FOR UPDATE
      USING (auth_user_id = auth.uid());

    CREATE POLICY "Service role can manage company profiles"
      ON public.company_profiles FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Update the ensure_client_account_robust function to use the correct table
CREATE OR REPLACE FUNCTION public.ensure_client_account_robust(user_id_param uuid, company_name_param text DEFAULT 'My Company'::text, first_name_param text DEFAULT ''::text, last_name_param text DEFAULT ''::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  user_email text;
  result jsonb;
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = user_id_param;
  
  IF user_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found',
      'is_client_account', false
    );
  END IF;
  
  -- Create account type record
  INSERT INTO public.account_types (auth_user_id, account_type)
  VALUES (user_id_param, 'client')
  ON CONFLICT (auth_user_id, account_type) DO UPDATE SET
    account_type = 'client',
    created_at = COALESCE(account_types.created_at, NOW());
  
  -- Create company profile in public schema
  INSERT INTO public.company_profiles (
    auth_user_id,
    company_name,
    contact_first_name,
    contact_last_name,
    billing_email,
    contact_email,
    onboarding_status
  )
  VALUES (
    user_id_param,
    company_name_param,
    first_name_param,
    last_name_param,
    user_email,
    user_email,
    'incomplete'
  )
  ON CONFLICT (auth_user_id) DO UPDATE SET
    company_name = CASE 
      WHEN EXCLUDED.company_name != 'My Company' AND EXCLUDED.company_name != ''
      THEN EXCLUDED.company_name
      ELSE company_profiles.company_name
    END,
    contact_first_name = CASE
      WHEN EXCLUDED.contact_first_name != ''
      THEN EXCLUDED.contact_first_name
      ELSE company_profiles.contact_first_name
    END,
    contact_last_name = CASE
      WHEN EXCLUDED.contact_last_name != ''
      THEN EXCLUDED.contact_last_name
      ELSE company_profiles.contact_last_name
    END,
    updated_at = NOW();
  
  -- Verify creation was successful
  IF public.is_client_account(user_id_param) THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Client account created successfully',
      'is_client_account', true
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to verify client account creation',
      'is_client_account', false
    );
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error
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
      'ensure_client_account_robust',
      user_id_param,
      jsonb_build_object(
        'company_name', company_name_param,
        'first_name', first_name_param,
        'last_name', last_name_param,
        'email', user_email
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'is_client_account', false
    );
END;
$function$;

-- Update get_client_account_status to use correct table reference
CREATE OR REPLACE FUNCTION public.get_client_account_status(user_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  user_record record;
  account_type_record record;
  profile_record record;
  result jsonb;
BEGIN
  -- Get user info from auth.users
  SELECT * INTO user_record FROM auth.users WHERE id = user_id_param;
  
  -- Get account type info
  SELECT * INTO account_type_record FROM public.account_types 
  WHERE auth_user_id = user_id_param;
  
  -- Get profile info from public schema
  SELECT * INTO profile_record FROM public.company_profiles 
  WHERE auth_user_id = user_id_param;
  
  -- Build comprehensive result
  result := jsonb_build_object(
    'user_exists', user_record.id IS NOT NULL,
    'user_email', user_record.email,
    'user_provider', user_record.raw_app_meta_data->>'provider',
    'account_type_exists', account_type_record.auth_user_id IS NOT NULL,
    'account_type', account_type_record.account_type,
    'profile_exists', profile_record.auth_user_id IS NOT NULL,
    'company_profile_exists', profile_record.auth_user_id IS NOT NULL,
    'is_client_account', public.is_client_account(user_id_param),
    'errors', ARRAY[]::text[]
  );
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    -- Return error information
    RETURN jsonb_build_object(
      'user_exists', false,
      'user_email', null,
      'user_provider', null,
      'account_type_exists', false,
      'account_type', null,
      'profile_exists', false,
      'company_profile_exists', false,
      'is_client_account', false,
      'errors', ARRAY[SQLERRM]
    );
END;
$function$;
