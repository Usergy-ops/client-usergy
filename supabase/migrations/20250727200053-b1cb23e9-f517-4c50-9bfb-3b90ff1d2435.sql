
-- Fix the create_client_account_for_user RPC function with correct ON CONFLICT clauses
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
  
  -- Create account_types record with correct conflict handling
  -- The unique constraint is on (auth_user_id, account_type)
  INSERT INTO public.account_types (auth_user_id, account_type)
  VALUES (user_id_param, 'client')
  ON CONFLICT (auth_user_id, account_type) DO UPDATE SET 
    created_at = COALESCE(account_types.created_at, NOW());
  
  -- Create client workspace profile with correct conflict handling
  -- The unique constraint is on auth_user_id
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

-- Add missing unique constraint on account_types if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'account_types_auth_user_id_account_type_key'
  ) THEN
    ALTER TABLE public.account_types 
    ADD CONSTRAINT account_types_auth_user_id_account_type_key 
    UNIQUE (auth_user_id, account_type);
  END IF;
END $$;

-- Ensure the company_profiles table has the correct unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'company_profiles_auth_user_id_key'
  ) THEN
    ALTER TABLE client_workspace.company_profiles 
    ADD CONSTRAINT company_profiles_auth_user_id_key 
    UNIQUE (auth_user_id);
  END IF;
END $$;
