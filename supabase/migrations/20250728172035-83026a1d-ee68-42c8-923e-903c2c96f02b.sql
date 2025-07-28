
-- FINAL COMPREHENSIVE FIX: Diagnostic and fix for authentication issues

-- 1. First, let's check what's actually in the database
-- Create a diagnostic function to check user accounts
CREATE OR REPLACE FUNCTION public.diagnose_user_account(user_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace', 'auth'
AS $function$
DECLARE
  result jsonb;
  user_record record;
  account_type_record record;
  profile_record record;
BEGIN
  -- Get user info
  SELECT * INTO user_record FROM auth.users WHERE id = user_id_param;
  
  -- Get account type info
  SELECT * INTO account_type_record FROM public.account_types 
  WHERE auth_user_id = user_id_param;
  
  -- Get profile info
  SELECT * INTO profile_record FROM client_workspace.company_profiles 
  WHERE auth_user_id = user_id_param;
  
  result := jsonb_build_object(
    'user_exists', user_record.id IS NOT NULL,
    'user_email', user_record.email,
    'user_provider', user_record.raw_app_meta_data->>'provider',
    'account_type_exists', account_type_record.auth_user_id IS NOT NULL,
    'account_type', account_type_record.account_type,
    'profile_exists', profile_record.auth_user_id IS NOT NULL,
    'profile_company', profile_record.company_name,
    'is_client_account_result', public.is_client_account(user_id_param)
  );
  
  RETURN result;
END;
$function$;

-- 2. Fix the is_client_account function to be absolutely reliable
CREATE OR REPLACE FUNCTION public.is_client_account(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace'
AS $function$
DECLARE
  account_exists boolean := false;
BEGIN
  -- Simple, reliable check
  SELECT EXISTS(
    SELECT 1 FROM public.account_types 
    WHERE auth_user_id = user_id_param AND account_type = 'client'
  ) INTO account_exists;
  
  -- Log the check for debugging
  INSERT INTO public.error_logs (
    error_type,
    error_message,
    context,
    user_id,
    metadata
  ) VALUES (
    'debug',
    'is_client_account check',
    'is_client_account_function',
    user_id_param,
    jsonb_build_object(
      'result', account_exists,
      'timestamp', now()
    )
  );
  
  RETURN account_exists;
END;
$function$;

-- 3. Create a manual account creation function for testing
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
  
  -- Force create company profile
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
    'My Company',
    'User',
    'Name',
    user_email,
    'incomplete'
  )
  ON CONFLICT (auth_user_id) DO UPDATE SET
    updated_at = NOW();
  
  -- Log the forced creation
  INSERT INTO public.error_logs (
    error_type,
    error_message,
    context,
    user_id,
    metadata
  ) VALUES (
    'info',
    'Client account force created',
    'force_create_client_account',
    user_id_param,
    jsonb_build_object(
      'email', user_email,
      'method', 'manual_force_create'
    )
  );
  
  RETURN TRUE;
END;
$function$;

-- 4. Fix the Google OAuth trigger with better error handling
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
  -- Log that trigger fired
  INSERT INTO public.error_logs (
    error_type,
    error_message,
    context,
    user_id,
    metadata
  ) VALUES (
    'info',
    'Google OAuth trigger fired',
    'handle_google_oauth_client_signup',
    NEW.id,
    jsonb_build_object(
      'email', NEW.email,
      'provider', NEW.raw_app_meta_data->>'provider',
      'full_name', NEW.raw_user_meta_data->>'full_name'
    )
  );
  
  -- Only process Google OAuth users
  IF NEW.raw_app_meta_data->>'provider' = 'google' THEN
    
    -- Check if client profile already exists
    SELECT EXISTS(
      SELECT 1 FROM client_workspace.company_profiles 
      WHERE auth_user_id = NEW.id
    ) INTO profile_exists;
    
    -- Only create if profile doesn't exist
    IF NOT profile_exists THEN
      -- Create account type record first
      INSERT INTO public.account_types (auth_user_id, account_type)
      VALUES (NEW.id, 'client')
      ON CONFLICT (auth_user_id, account_type) DO UPDATE SET account_type = 'client';
      
      -- Extract name parts from Google metadata
      full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
      name_parts := string_to_array(full_name, ' ');
      first_name := COALESCE(name_parts[1], '');
      last_name := COALESCE(array_to_string(name_parts[2:], ' '), '');
      
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
        NEW.id,
        'My Company',
        first_name,
        last_name,
        NEW.email,
        'incomplete'
      );
      
      -- Log successful client account creation
      INSERT INTO public.error_logs (
        error_type,
        error_message,
        context,
        user_id,
        metadata
      ) VALUES (
        'info',
        'Client account created successfully for Google OAuth user',
        'handle_google_oauth_client_signup',
        NEW.id,
        jsonb_build_object(
          'email', NEW.email,
          'company_name', 'My Company',
          'first_name', first_name,
          'last_name', last_name
        )
      );
    ELSE
      -- Log that profile already exists
      INSERT INTO public.error_logs (
        error_type,
        error_message,
        context,
        user_id,
        metadata
      ) VALUES (
        'info',
        'Client profile already exists for Google OAuth user',
        'handle_google_oauth_client_signup',
        NEW.id,
        jsonb_build_object(
          'email', NEW.email
        )
      );
    END IF;
    
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
      'google_oauth_client_creation_error',
      SQLERRM,
      'handle_google_oauth_client_signup',
      NEW.id,
      jsonb_build_object(
        'error_detail', SQLERRM,
        'sql_state', SQLSTATE,
        'email', NEW.email
      )
    );
    RAISE WARNING 'Failed to create client profile for Google OAuth user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$function$;

-- 5. Drop and recreate the trigger
DROP TRIGGER IF EXISTS on_google_oauth_client_signup ON auth.users;
DROP TRIGGER IF EXISTS on_google_oauth_user_created ON auth.users;

CREATE TRIGGER on_google_oauth_client_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_google_oauth_client_signup();

-- 6. Log the migration completion
INSERT INTO public.error_logs (
  error_type,
  error_message,
  context,
  metadata
) VALUES (
  'info',
  'Final comprehensive fix applied successfully',
  'migration',
  jsonb_build_object(
    'migration', '20250127205000-diagnostic-and-fix',
    'functions_created', ARRAY['diagnose_user_account', 'force_create_client_account'],
    'functions_updated', ARRAY['is_client_account', 'handle_google_oauth_client_signup'],
    'triggers_created', ARRAY['on_google_oauth_client_signup']
  )
);
