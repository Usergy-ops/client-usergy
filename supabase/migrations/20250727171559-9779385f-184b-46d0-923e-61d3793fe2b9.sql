
-- Fix 1: Update the Google OAuth trigger to use the correct metadata field
CREATE OR REPLACE FUNCTION public.handle_google_oauth_client_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'client_workspace', 'auth'
AS $function$
BEGIN
  -- Only process Google OAuth users - FIX: Use raw_app_meta_data instead of app_metadata
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
$function$;

-- Fix 2: Add unique constraint to client_workspace.company_profiles if it doesn't exist
-- This will prevent the ON CONFLICT error in create_client_account_for_user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'company_profiles_auth_user_id_unique'
    AND table_name = 'company_profiles'
    AND table_schema = 'client_workspace'
  ) THEN
    ALTER TABLE client_workspace.company_profiles 
    ADD CONSTRAINT company_profiles_auth_user_id_unique UNIQUE (auth_user_id);
  END IF;
END $$;

-- Fix 3: Update the create_client_account_for_user function to handle conflicts better
CREATE OR REPLACE FUNCTION public.create_client_account_for_user(user_id_param uuid, company_name_param text DEFAULT 'My Company'::text, first_name_param text DEFAULT NULL::text, last_name_param text DEFAULT NULL::text)
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
  
  -- Create account_types record first
  INSERT INTO public.account_types (auth_user_id, account_type)
  VALUES (user_id_param, 'client')
  ON CONFLICT (auth_user_id) DO UPDATE SET account_type = 'client';
  
  -- Create client workspace profile with better conflict handling
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
$function$;
