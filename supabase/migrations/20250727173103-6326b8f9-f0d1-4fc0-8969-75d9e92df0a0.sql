
-- First, let's check if the client_workspace.company_profiles table has the right structure
-- and fix the Google OAuth trigger

-- Update the Google OAuth trigger to handle the missing column issue
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
BEGIN
  -- Only process Google OAuth users
  IF NEW.raw_app_meta_data->>'provider' = 'google' THEN
    
    -- Log the Google OAuth signup attempt
    INSERT INTO public.error_logs (
      error_type,
      error_message,
      context,
      user_id,
      metadata
    ) VALUES (
      'info',
      'Google OAuth user detected, creating client account',
      'handle_google_oauth_client_signup',
      NEW.id,
      jsonb_build_object(
        'email', NEW.email,
        'provider', 'google',
        'full_name', NEW.raw_user_meta_data->>'full_name'
      )
    );
    
    -- Create account type record first
    INSERT INTO public.account_types (auth_user_id, account_type)
    VALUES (NEW.id, 'client')
    ON CONFLICT (auth_user_id) DO UPDATE SET account_type = 'client';
    
    -- Extract name parts from Google metadata
    full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
    name_parts := string_to_array(full_name, ' ');
    first_name := COALESCE(name_parts[1], '');
    last_name := COALESCE(array_to_string(name_parts[2:], ' '), '');
    
    -- Create client workspace profile with proper error handling
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
    )
    ON CONFLICT (auth_user_id) DO UPDATE SET
      contact_first_name = CASE 
        WHEN EXCLUDED.contact_first_name IS NOT NULL AND EXCLUDED.contact_first_name != '' 
        THEN EXCLUDED.contact_first_name 
        ELSE company_profiles.contact_first_name 
      END,
      contact_last_name = CASE 
        WHEN EXCLUDED.contact_last_name IS NOT NULL AND EXCLUDED.contact_last_name != '' 
        THEN EXCLUDED.contact_last_name 
        ELSE company_profiles.contact_last_name 
      END,
      updated_at = NOW();
    
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

-- Update the regular client account creation trigger to handle email signups
CREATE OR REPLACE FUNCTION public.handle_client_account_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace', 'auth'
AS $function$
BEGIN
  -- Check if this is a client signup (email signup with metadata)
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
      company_name = CASE 
        WHEN EXCLUDED.company_name IS NOT NULL AND EXCLUDED.company_name != '' 
        THEN EXCLUDED.company_name 
        ELSE company_profiles.company_name 
      END,
      contact_first_name = CASE 
        WHEN EXCLUDED.contact_first_name IS NOT NULL AND EXCLUDED.contact_first_name != '' 
        THEN EXCLUDED.contact_first_name 
        ELSE company_profiles.contact_first_name 
      END,
      contact_last_name = CASE 
        WHEN EXCLUDED.contact_last_name IS NOT NULL AND EXCLUDED.contact_last_name != '' 
        THEN EXCLUDED.contact_last_name 
        ELSE company_profiles.contact_last_name 
      END,
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
$function$;

-- Ensure we have proper triggers set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_google_oauth_user_created ON auth.users;

-- Create trigger for regular client account creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_client_account_creation();

-- Create trigger for Google OAuth client creation
CREATE TRIGGER on_google_oauth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_google_oauth_client_signup();
