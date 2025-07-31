
-- Phase 1: Fix Backend Account Assignment
-- Update the assign_account_type_by_domain function to default to 'client' for client.usergy.ai signups

CREATE OR REPLACE FUNCTION public.assign_account_type_by_domain(user_id_param uuid, user_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  account_type_to_assign text;
  full_name text;
  name_parts text[];
  first_name text := '';
  last_name text := '';
  user_metadata jsonb;
  signup_source text;
  metadata_account_type text;
  referrer_url text;
BEGIN
  -- Get user metadata from auth.users table
  SELECT raw_user_meta_data INTO user_metadata 
  FROM auth.users 
  WHERE id = user_id_param;
  
  -- Extract relevant metadata fields
  signup_source := user_metadata->>'signup_source';
  metadata_account_type := COALESCE(
    user_metadata->>'account_type',
    user_metadata->>'accountType'
  );
  referrer_url := user_metadata->>'referrer_url';
  
  -- Log the metadata analysis
  INSERT INTO public.error_logs (
    error_type,
    error_message,
    context,
    user_id,
    metadata
  ) VALUES (
    'info',
    'Account type assignment - analyzing metadata for client.usergy.ai signup',
    'assign_account_type_by_domain',
    user_id_param,
    jsonb_build_object(
      'email', user_email,
      'signup_source', signup_source,
      'metadata_account_type', metadata_account_type,
      'referrer_url', referrer_url,
      'raw_metadata', user_metadata
    )
  );
  
  -- PRIORITY 1: Check for explicit user designation (rare edge case)
  IF metadata_account_type = 'user' OR signup_source = 'user_signup' THEN
    account_type_to_assign := 'user';
    
    INSERT INTO public.error_logs (
      error_type,
      error_message,
      context,
      user_id,
      metadata
    ) VALUES (
      'info',
      'User account type assigned from explicit metadata',
      'assign_account_type_by_domain',
      user_id_param,
      jsonb_build_object(
        'email', user_email,
        'reason', 'explicit_user_metadata',
        'metadata_account_type', metadata_account_type,
        'signup_source', signup_source
      )
    );
    
  -- PRIORITY 2: Check for specific user domains (if any exist in the future)
  ELSIF user_email LIKE '%@user.usergy.ai' THEN
    account_type_to_assign := 'user';
    
    INSERT INTO public.error_logs (
      error_type,
      error_message,
      context,
      user_id,
      metadata
    ) VALUES (
      'info',
      'User account type assigned from email domain',
      'assign_account_type_by_domain',
      user_id_param,
      jsonb_build_object(
        'email', user_email,
        'reason', 'user_domain'
      )
    );
    
  -- PRIORITY 3: Default to CLIENT for ALL signups via client.usergy.ai or any client-related signup
  ELSE
    account_type_to_assign := 'client';
    
    INSERT INTO public.error_logs (
      error_type,
      error_message,
      context,
      user_id,
      metadata
    ) VALUES (
      'info',
      'Client account type assigned - default for client.usergy.ai signups',
      'assign_account_type_by_domain',
      user_id_param,
      jsonb_build_object(
        'email', user_email,
        'reason', CASE 
          WHEN metadata_account_type = 'client' OR signup_source = 'enhanced_client_signup' THEN 'explicit_client_metadata'
          WHEN user_email LIKE '%@client.usergy.ai' THEN 'client_domain'
          WHEN user_metadata->>'provider' = 'google' THEN 'google_oauth_client_default'
          WHEN referrer_url LIKE '%client.usergy.ai%' THEN 'client_referrer_url'
          ELSE 'default_client_fallback'
        END,
        'provider', user_metadata->>'provider',
        'referrer_url', referrer_url
      )
    );
  END IF;
  
  -- Insert account type (will not conflict due to unique constraint on auth_user_id)
  INSERT INTO public.account_types (auth_user_id, account_type)
  VALUES (user_id_param, account_type_to_assign)
  ON CONFLICT (auth_user_id) DO UPDATE SET
    account_type = EXCLUDED.account_type,
    created_at = COALESCE(account_types.created_at, NOW());
  
  -- If this is a user, ensure they have a profile
  IF account_type_to_assign = 'user' THEN
    -- Get user metadata for profile creation
    SELECT COALESCE(
      user_metadata->>'full_name',
      user_metadata->>'name',
      'User'
    ) INTO full_name;
    
    -- Parse name if available
    IF full_name != '' AND full_name != 'User' THEN
      name_parts := string_to_array(full_name, ' ');
      first_name := COALESCE(name_parts[1], '');
      last_name := COALESCE(array_to_string(name_parts[2:], ' '), '');
    END IF;
    
    -- Create profile for user workflow
    INSERT INTO public.profiles (
      user_id, 
      email, 
      full_name,
      completion_percentage
    )
    VALUES (
      user_id_param, 
      user_email,
      CASE WHEN full_name != 'User' THEN full_name ELSE NULL END,
      0
    )
    ON CONFLICT (user_id) DO UPDATE SET
      email = EXCLUDED.email,
      updated_at = NOW();
  END IF;
  
  -- If this is a client, ensure they have a client profile
  IF account_type_to_assign = 'client' THEN
    -- Extract name from metadata
    SELECT COALESCE(
      user_metadata->>'full_name',
      user_metadata->>'name',
      ''
    ) INTO full_name;
    
    IF full_name != '' THEN
      name_parts := string_to_array(full_name, ' ');
      first_name := COALESCE(name_parts[1], '');
      last_name := COALESCE(array_to_string(name_parts[2:], ' '), '');
    END IF;
    
    -- Use metadata values if available, otherwise use extracted names
    first_name := COALESCE(
      user_metadata->>'contactFirstName',
      user_metadata->>'first_name',
      first_name,
      ''
    );
    
    last_name := COALESCE(
      user_metadata->>'contactLastName',
      user_metadata->>'last_name',
      last_name,
      ''
    );
    
    -- Create client profile using the existing client schema
    PERFORM public.ensure_client_account_robust(
      user_id_param,
      COALESCE(user_metadata->>'companyName', user_metadata->>'company_name', 'My Company'),
      first_name,
      last_name
    );
  END IF;
  
  -- Log the final assignment
  INSERT INTO public.error_logs (
    error_type,
    error_message,
    context,
    user_id,
    metadata
  ) VALUES (
    'info',
    'Account type assignment completed successfully - defaulting to client for client.usergy.ai',
    'assign_account_type_by_domain',
    user_id_param,
    jsonb_build_object(
      'email', user_email,
      'final_account_type', account_type_to_assign,
      'assignment_method', CASE 
        WHEN metadata_account_type = 'user' OR signup_source = 'user_signup' THEN 'explicit_user_metadata'
        WHEN user_email LIKE '%@user.usergy.ai' THEN 'user_domain'
        WHEN metadata_account_type = 'client' OR signup_source = 'enhanced_client_signup' THEN 'explicit_client_metadata'
        WHEN user_email LIKE '%@client.usergy.ai' THEN 'client_domain'
        WHEN user_metadata->>'provider' = 'google' THEN 'google_oauth_client_default'
        WHEN referrer_url LIKE '%client.usergy.ai%' THEN 'client_referrer_url'
        ELSE 'default_client_fallback'
      END
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'account_type', account_type_to_assign,
    'message', 'Account type assigned successfully - defaulting to client for client.usergy.ai',
    'assignment_method', CASE 
      WHEN metadata_account_type = 'user' OR signup_source = 'user_signup' THEN 'explicit_user_metadata'
      WHEN user_email LIKE '%@user.usergy.ai' THEN 'user_domain'
      WHEN metadata_account_type = 'client' OR signup_source = 'enhanced_client_signup' THEN 'explicit_client_metadata'
      WHEN user_email LIKE '%@client.usergy.ai' THEN 'client_domain'
      WHEN user_metadata->>'provider' = 'google' THEN 'google_oauth_client_default'
      WHEN referrer_url LIKE '%client.usergy.ai%' THEN 'client_referrer_url'
      ELSE 'default_client_fallback'
    END
  );
  
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
      'account_assignment_error',
      SQLERRM,
      SQLSTATE,
      'assign_account_type_by_domain',
      user_id_param,
      jsonb_build_object(
        'email', user_email,
        'error_detail', SQLERRM,
        'user_metadata', user_metadata
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;

-- Create a new trigger specifically for client account assignment
CREATE OR REPLACE FUNCTION public.handle_client_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  -- Only process confirmed users (email confirmed or OAuth)
  IF NEW.email_confirmed_at IS NOT NULL OR 
     NEW.raw_app_meta_data->>'provider' IN ('google', 'github') THEN
    
    -- Assign account type based on domain and metadata - defaults to client for client.usergy.ai signups
    PERFORM public.assign_account_type_by_domain(NEW.id, NEW.email);
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but never block user creation
    INSERT INTO public.error_logs (
      error_type,
      error_message,
      context,
      user_id,
      metadata
    ) VALUES (
      'client_signup_trigger_error',
      SQLERRM,
      'handle_client_user_signup',
      NEW.id,
      jsonb_build_object(
        'email', NEW.email,
        'error_detail', SQLERRM
      )
    );
    
    RETURN NEW;
END;
$function$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_auth_user_created_unified ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_account_type ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;

-- Create the new trigger for client account assignment
CREATE TRIGGER on_auth_user_created_client
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_client_user_signup();

-- Ensure we have a helper function for client account creation
CREATE OR REPLACE FUNCTION public.ensure_client_account(user_id_param uuid, company_name_param text DEFAULT 'My Company', first_name_param text DEFAULT '', last_name_param text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  user_email text;
  full_name_value text;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO user_email FROM auth.users WHERE id = user_id_param;
  
  IF user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Build full name
  full_name_value := TRIM(CONCAT(first_name_param, ' ', last_name_param));
  IF full_name_value = '' THEN
    full_name_value := NULL;
  END IF;
  
  -- Insert or update client record in client_workflow schema
  INSERT INTO client_workflow.clients (
    auth_user_id,
    email,
    full_name,
    company_name
  ) VALUES (
    user_id_param,
    user_email,
    full_name_value,
    company_name_param
  )
  ON CONFLICT (auth_user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, client_workflow.clients.full_name),
    company_name = COALESCE(EXCLUDED.company_name, client_workflow.clients.company_name),
    updated_at = now();
    
  RETURN jsonb_build_object('success', true, 'message', 'Client account ensured in client_workflow schema');
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;
