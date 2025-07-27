
-- Fix the billing_email column in company_profiles table
ALTER TABLE client_workspace.company_profiles 
ADD COLUMN IF NOT EXISTS billing_email text;

-- Update the create_client_account_for_user function to fix conflict handling
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
  
  -- Create account_types record first
  INSERT INTO public.account_types (auth_user_id, account_type)
  VALUES (user_id_param, 'client')
  ON CONFLICT (auth_user_id) DO UPDATE SET 
    account_type = 'client',
    created_at = COALESCE(account_types.created_at, NOW());
  
  -- Create client workspace profile with proper conflict handling
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
    billing_email = COALESCE(EXCLUDED.billing_email, company_profiles.billing_email),
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

-- Create a simple function to check if user is client without complex logic
CREATE OR REPLACE FUNCTION public.is_client_account(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace'
AS $function$
DECLARE
  result boolean := false;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.account_types 
    WHERE auth_user_id = user_id_param AND account_type = 'client'
  ) INTO result;
  
  RETURN result;
END;
$function$;
