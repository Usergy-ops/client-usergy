
-- Update the assign_account_type_by_domain function to default all accounts to 'client'
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
  
  -- Log the metadata analysis
  INSERT INTO public.error_logs (
    error_type,
    error_message,
    context,
    user_id,
    metadata
  ) VALUES (
    'info',
    'Account type assignment - analyzing metadata (updated to default client)',
    'assign_account_type_by_domain',
    user_id_param,
    jsonb_build_object(
      'email', user_email,
      'signup_source', signup_source,
      'metadata_account_type', metadata_account_type,
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
    
  -- PRIORITY 3: Default to CLIENT for ALL other cases (including Google OAuth, enhanced signup, and general signups)
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
      'Client account type assigned as default (updated behavior)',
      'assign_account_type_by_domain',
      user_id_param,
      jsonb_build_object(
        'email', user_email,
        'reason', CASE 
          WHEN metadata_account_type = 'client' OR signup_source = 'enhanced_client_signup' THEN 'explicit_client_metadata'
          WHEN user_email LIKE '%@client.usergy.ai' THEN 'client_domain'
          WHEN user_metadata->>'provider' = 'google' THEN 'google_oauth_default_client'
          ELSE 'default_client_fallback'
        END,
        'provider', user_metadata->>'provider'
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
    'Account type assignment completed successfully (updated to default client)',
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
        WHEN user_metadata->>'provider' = 'google' THEN 'google_oauth_default_client'
        ELSE 'default_client_fallback'
      END
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'account_type', account_type_to_assign,
    'message', 'Account type assigned successfully (updated to default client)',
    'assignment_method', CASE 
      WHEN metadata_account_type = 'user' OR signup_source = 'user_signup' THEN 'explicit_user_metadata'
      WHEN user_email LIKE '%@user.usergy.ai' THEN 'user_domain'
      WHEN metadata_account_type = 'client' OR signup_source = 'enhanced_client_signup' THEN 'explicit_client_metadata'
      WHEN user_email LIKE '%@client.usergy.ai' THEN 'client_domain'
      WHEN user_metadata->>'provider' = 'google' THEN 'google_oauth_default_client'
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
$function$
