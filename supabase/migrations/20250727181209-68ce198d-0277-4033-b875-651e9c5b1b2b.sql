
-- Fix the database schema issues for client_workspace.company_profiles

-- First, let's check if there are duplicate unique constraints and fix them
-- We need to ensure only one unique constraint exists on auth_user_id

-- Drop any duplicate unique constraints if they exist
DO $$ 
BEGIN
  -- Check if duplicate unique constraints exist and drop them
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name != 'company_profiles_auth_user_id_key' 
    AND table_name = 'company_profiles' 
    AND table_schema = 'client_workspace'
    AND constraint_type = 'UNIQUE'
    AND constraint_name LIKE '%auth_user_id%'
  ) THEN
    -- Drop duplicate constraints (keeping the main one)
    EXECUTE 'ALTER TABLE client_workspace.company_profiles DROP CONSTRAINT IF EXISTS company_profiles_auth_user_id_key1';
    EXECUTE 'ALTER TABLE client_workspace.company_profiles DROP CONSTRAINT IF EXISTS company_profiles_auth_user_id_key2';
  END IF;
END $$;

-- Ensure the primary unique constraint exists
ALTER TABLE client_workspace.company_profiles 
ADD CONSTRAINT company_profiles_auth_user_id_key UNIQUE (auth_user_id)
ON CONFLICT DO NOTHING;

-- Make sure required fields have proper defaults to prevent constraint violations
ALTER TABLE client_workspace.company_profiles 
ALTER COLUMN company_name SET DEFAULT 'My Company';

ALTER TABLE client_workspace.company_profiles 
ALTER COLUMN contact_first_name SET DEFAULT '';

ALTER TABLE client_workspace.company_profiles 
ALTER COLUMN contact_last_name SET DEFAULT '';

ALTER TABLE client_workspace.company_profiles 
ALTER COLUMN onboarding_status SET DEFAULT 'incomplete';

-- Update the create_client_account_for_user function to handle conflicts better
CREATE OR REPLACE FUNCTION public.create_client_account_for_user(
  user_id_param uuid, 
  company_name_param text DEFAULT 'My Company'::text, 
  first_name_param text DEFAULT ''::text, 
  last_name_param text DEFAULT ''::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace', 'auth'
AS $function$
DECLARE
  user_email TEXT;
  existing_profile_count INTEGER;
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = user_id_param;
  
  IF user_email IS NULL THEN
    RAISE EXCEPTION 'User not found with ID: %', user_id_param;
  END IF;
  
  -- Check if profile already exists
  SELECT COUNT(*) INTO existing_profile_count 
  FROM client_workspace.company_profiles 
  WHERE auth_user_id = user_id_param;
  
  -- Create account_types record first
  INSERT INTO public.account_types (auth_user_id, account_type)
  VALUES (user_id_param, 'client')
  ON CONFLICT (auth_user_id) DO UPDATE SET account_type = 'client';
  
  -- Only create profile if it doesn't exist
  IF existing_profile_count = 0 THEN
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
      COALESCE(company_name_param, 'My Company'),
      COALESCE(first_name_param, ''),
      COALESCE(last_name_param, ''), 
      user_email,
      'incomplete'
    );
  ELSE
    -- Update existing profile if needed
    UPDATE client_workspace.company_profiles SET
      company_name = CASE 
        WHEN company_name_param IS NOT NULL AND company_name_param != '' 
        THEN company_name_param 
        ELSE company_name 
      END,
      contact_first_name = CASE 
        WHEN first_name_param IS NOT NULL AND first_name_param != '' 
        THEN first_name_param 
        ELSE contact_first_name 
      END,
      contact_last_name = CASE 
        WHEN last_name_param IS NOT NULL AND last_name_param != '' 
        THEN last_name_param 
        ELSE contact_last_name 
      END,
      billing_email = user_email,
      updated_at = NOW()
    WHERE auth_user_id = user_id_param;
  END IF;
  
  -- Log the account creation
  INSERT INTO public.error_logs (
    error_type,
    error_message,
    context,
    user_id,
    metadata
  ) VALUES (
    'info',
    'Client account created/updated successfully',
    'create_client_account_for_user',
    user_id_param,
    jsonb_build_object(
      'company_name', COALESCE(company_name_param, 'My Company'),
      'method', 'rpc_function',
      'email', user_email,
      'existing_profile', existing_profile_count > 0
    )
  );
  
  RETURN TRUE;
EXCEPTION
  WHEN unique_violation THEN
    -- Handle unique constraint violations gracefully
    INSERT INTO public.error_logs (
      error_type,
      error_message,
      context,
      user_id,
      metadata
    ) VALUES (
      'info',
      'Client account already exists, skipping creation',
      'create_client_account_for_user',
      user_id_param,
      jsonb_build_object(
        'company_name', company_name_param,
        'email', user_email,
        'error', 'unique_violation'
      )
    );
    RETURN TRUE;
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

-- Update the Google OAuth trigger to be more robust
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
    
    -- Check if client profile already exists
    SELECT EXISTS(
      SELECT 1 FROM client_workspace.company_profiles 
      WHERE auth_user_id = NEW.id
    ) INTO profile_exists;
    
    -- Only create if profile doesn't exist
    IF NOT profile_exists THEN
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
    END IF;
    
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Handle unique constraint violations gracefully
    INSERT INTO public.error_logs (
      error_type,
      error_message,
      context,
      user_id,
      metadata
    ) VALUES (
      'info',
      'Google OAuth client account already exists, skipping creation',
      'handle_google_oauth_client_signup',
      NEW.id,
      jsonb_build_object(
        'error', 'unique_violation',
        'email', NEW.email
      )
    );
    RETURN NEW;
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
