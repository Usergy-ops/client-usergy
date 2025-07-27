
-- Create the missing check_user_is_client RPC function
CREATE OR REPLACE FUNCTION public.check_user_is_client(user_id_param uuid)
RETURNS TABLE(is_client boolean, account_exists boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN at.account_type = 'client' THEN true
      ELSE false
    END as is_client,
    CASE 
      WHEN at.auth_user_id IS NOT NULL THEN true
      ELSE false
    END as account_exists
  FROM public.account_types at
  WHERE at.auth_user_id = user_id_param;
  
  -- If no record found, return false for both
  IF NOT FOUND THEN
    RETURN QUERY SELECT false as is_client, false as account_exists;
  END IF;
END;
$$;

-- Create a trigger to automatically create client accounts for Google OAuth users
CREATE OR REPLACE FUNCTION public.handle_google_oauth_client_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace', 'auth'
AS $$
BEGIN
  -- Only process Google OAuth users
  IF NEW.app_metadata->>'provider' = 'google' THEN
    
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
        'full_name', NEW.user_metadata->>'full_name'
      )
    );
    
    -- Create account type record
    INSERT INTO public.account_types (auth_user_id, account_type)
    VALUES (NEW.id, 'client')
    ON CONFLICT (auth_user_id) DO UPDATE SET account_type = 'client';
    
    -- Extract name parts from Google metadata
    DECLARE
      full_name TEXT := COALESCE(NEW.user_metadata->>'full_name', '');
      name_parts TEXT[];
      first_name TEXT;
      last_name TEXT;
    BEGIN
      name_parts := string_to_array(full_name, ' ');
      first_name := COALESCE(name_parts[1], '');
      last_name := COALESCE(array_to_string(name_parts[2:], ' '), '');
    END;
    
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
    )
    ON CONFLICT (auth_user_id) DO UPDATE SET
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
$$;

-- Create the trigger for Google OAuth signups
DROP TRIGGER IF EXISTS on_google_oauth_client_signup ON auth.users;
CREATE TRIGGER on_google_oauth_client_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_google_oauth_client_signup();

-- Update the existing client account creation trigger to be more robust
DROP TRIGGER IF EXISTS on_client_account_creation ON auth.users;
CREATE TRIGGER on_client_account_creation
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_client_account_creation();
