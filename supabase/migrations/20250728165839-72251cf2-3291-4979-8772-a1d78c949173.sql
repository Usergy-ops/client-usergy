
-- CRITICAL FIX: Simplify and make is_client_account function more reliable
CREATE OR REPLACE FUNCTION public.is_client_account(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace'
AS $function$
DECLARE
  account_exists boolean := false;
BEGIN
  -- Simple check: if user has an account_types record for 'client', they are a client
  SELECT EXISTS(
    SELECT 1 FROM public.account_types 
    WHERE auth_user_id = user_id_param AND account_type = 'client'
  ) INTO account_exists;
  
  RETURN account_exists;
END;
$function$;

-- CRITICAL FIX: Ensure Google OAuth trigger is working properly
-- Drop and recreate the trigger to ensure it's active

-- First, drop existing triggers
DROP TRIGGER IF EXISTS on_google_oauth_client_signup ON auth.users;
DROP TRIGGER IF EXISTS on_google_oauth_user_created ON auth.users;

-- Ensure the function exists and is correct
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
    
    -- Log the trigger execution
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
        'provider', 'google',
        'full_name', NEW.raw_user_meta_data->>'full_name'
      )
    );
    
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

-- Create the trigger
CREATE TRIGGER on_google_oauth_client_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_google_oauth_client_signup();

-- Log the trigger creation
INSERT INTO public.error_logs (
  error_type,
  error_message,
  context,
  metadata
) VALUES (
  'info',
  'Google OAuth trigger recreated successfully',
  'migration',
  jsonb_build_object(
    'migration', '20250727204000-fix-google-oauth-trigger',
    'trigger_name', 'on_google_oauth_client_signup'
  )
);
