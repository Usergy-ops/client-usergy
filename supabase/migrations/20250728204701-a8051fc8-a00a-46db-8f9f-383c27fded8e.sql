
-- Fix database schema mismatches and add missing RLS policies

-- 1. Fix the profiles table to match the diagnoseAccount function expectation
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company TEXT;

-- 2. Update account_types table to use correct column name for user reference
-- The diagnoseAccount function expects 'user_id' but the table uses 'auth_user_id'
-- Let's add an index and ensure consistency
CREATE INDEX IF NOT EXISTS idx_account_types_auth_user_id ON public.account_types(auth_user_id);

-- 3. Add missing RLS policies for account_types table
CREATE POLICY IF NOT EXISTS "Users can insert their own account type" 
  ON public.account_types 
  FOR INSERT 
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can update their own account type" 
  ON public.account_types 
  FOR UPDATE 
  USING (auth_user_id = auth.uid());

-- 4. Add missing RLS policies for client_workspace.company_profiles
-- First, let's check if the schema exists and create policies
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'client_workspace') THEN
    -- Enable RLS on company_profiles if it exists
    EXECUTE 'ALTER TABLE client_workspace.company_profiles ENABLE ROW LEVEL SECURITY';
    
    -- Create RLS policies for company_profiles
    EXECUTE 'CREATE POLICY IF NOT EXISTS "Users can view their own company profile" 
      ON client_workspace.company_profiles 
      FOR SELECT 
      USING (auth_user_id = auth.uid())';
      
    EXECUTE 'CREATE POLICY IF NOT EXISTS "Users can insert their own company profile" 
      ON client_workspace.company_profiles 
      FOR INSERT 
      WITH CHECK (auth_user_id = auth.uid())';
      
    EXECUTE 'CREATE POLICY IF NOT EXISTS "Users can update their own company profile" 
      ON client_workspace.company_profiles 
      FOR UPDATE 
      USING (auth_user_id = auth.uid())';
  END IF;
END $$;

-- 5. Create a unified function to check client account status with better error handling
CREATE OR REPLACE FUNCTION public.get_client_account_status(user_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'client_workspace', 'auth'
AS $$
DECLARE
  result jsonb;
  user_record record;
  account_type_record record;
  profile_record record;
  company_profile_record record;
BEGIN
  -- Initialize result
  result := jsonb_build_object(
    'user_exists', false,
    'user_email', 'N/A',
    'user_provider', 'N/A',
    'account_type_exists', false,
    'account_type', 'N/A',
    'profile_exists', false,
    'company_profile_exists', false,
    'is_client_account', false,
    'errors', jsonb_build_object()
  );
  
  -- Get user info
  SELECT * INTO user_record FROM auth.users WHERE id = user_id_param;
  
  IF user_record.id IS NOT NULL THEN
    result := jsonb_set(result, '{user_exists}', 'true'::jsonb);
    result := jsonb_set(result, '{user_email}', to_jsonb(user_record.email));
    result := jsonb_set(result, '{user_provider}', to_jsonb(COALESCE(user_record.raw_app_meta_data->>'provider', 'email')));
  END IF;
  
  -- Get account type info
  SELECT * INTO account_type_record FROM public.account_types 
  WHERE auth_user_id = user_id_param;
  
  IF account_type_record.auth_user_id IS NOT NULL THEN
    result := jsonb_set(result, '{account_type_exists}', 'true'::jsonb);
    result := jsonb_set(result, '{account_type}', to_jsonb(account_type_record.account_type));
    
    -- Check if is client account
    IF account_type_record.account_type = 'client' THEN
      result := jsonb_set(result, '{is_client_account}', 'true'::jsonb);
    END IF;
  END IF;
  
  -- Get profile info
  SELECT * INTO profile_record FROM public.profiles 
  WHERE user_id = user_id_param;
  
  IF profile_record.user_id IS NOT NULL THEN
    result := jsonb_set(result, '{profile_exists}', 'true'::jsonb);
  END IF;
  
  -- Get company profile info if client_workspace schema exists
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'client_workspace') THEN
    EXECUTE 'SELECT * FROM client_workspace.company_profiles WHERE auth_user_id = $1'
    INTO company_profile_record
    USING user_id_param;
    
    IF company_profile_record.auth_user_id IS NOT NULL THEN
      result := jsonb_set(result, '{company_profile_exists}', 'true'::jsonb);
    END IF;
  END IF;
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Return error information
    RETURN jsonb_build_object(
      'user_exists', false,
      'error', SQLERRM,
      'sql_state', SQLSTATE
    );
END;
$$;

-- 6. Improve the ensure_client_account function to be more robust
CREATE OR REPLACE FUNCTION public.ensure_client_account_robust(
  user_id_param uuid, 
  company_name_param text DEFAULT 'My Company',
  first_name_param text DEFAULT '',
  last_name_param text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'client_workspace', 'auth'
AS $$
DECLARE
  user_email TEXT;
  result jsonb;
  account_created BOOLEAN := false;
  profile_created BOOLEAN := false;
  company_profile_created BOOLEAN := false;
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = user_id_param;
  
  IF user_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found',
      'user_id', user_id_param::text
    );
  END IF;
  
  -- Create or update account type
  BEGIN
    INSERT INTO public.account_types (auth_user_id, account_type)
    VALUES (user_id_param, 'client')
    ON CONFLICT (auth_user_id) DO UPDATE SET
      account_type = 'client',
      created_at = COALESCE(account_types.created_at, NOW());
    
    account_created := true;
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM public.log_db_error('ensure_client_account_robust-account_type', SQLERRM, jsonb_build_object('user_id', user_id_param));
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Failed to create account type: ' || SQLERRM,
        'step', 'account_type_creation'
      );
  END;
  
  -- Create or update profile
  BEGIN
    INSERT INTO public.profiles (user_id, email, full_name, company)
    VALUES (
      user_id_param, 
      user_email, 
      TRIM(first_name_param || ' ' || last_name_param),
      company_name_param
    )
    ON CONFLICT (user_id) DO UPDATE SET
      full_name = CASE 
        WHEN EXCLUDED.full_name IS NOT NULL AND EXCLUDED.full_name != '' 
        THEN EXCLUDED.full_name 
        ELSE profiles.full_name 
      END,
      company = CASE 
        WHEN EXCLUDED.company IS NOT NULL AND EXCLUDED.company != '' 
        THEN EXCLUDED.company 
        ELSE profiles.company 
      END,
      updated_at = NOW();
    
    profile_created := true;
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM public.log_db_error('ensure_client_account_robust-profile', SQLERRM, jsonb_build_object('user_id', user_id_param));
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Failed to create profile: ' || SQLERRM,
        'step', 'profile_creation'
      );
  END;
  
  -- Create or update company profile if client_workspace schema exists
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'client_workspace') THEN
    BEGIN
      EXECUTE 'INSERT INTO client_workspace.company_profiles (
        auth_user_id, 
        company_name, 
        contact_first_name, 
        contact_last_name, 
        billing_email,
        contact_email,
        onboarding_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (auth_user_id) DO UPDATE SET
        company_name = CASE 
          WHEN EXCLUDED.company_name IS NOT NULL AND EXCLUDED.company_name != '''' 
          THEN EXCLUDED.company_name 
          ELSE company_profiles.company_name 
        END,
        contact_first_name = CASE
          WHEN EXCLUDED.contact_first_name IS NOT NULL AND EXCLUDED.contact_first_name != '''' 
          THEN EXCLUDED.contact_first_name 
          ELSE company_profiles.contact_first_name 
        END,
        contact_last_name = CASE
          WHEN EXCLUDED.contact_last_name IS NOT NULL AND EXCLUDED.contact_last_name != '''' 
          THEN EXCLUDED.contact_last_name 
          ELSE company_profiles.contact_last_name 
        END,
        onboarding_status = ''complete'',
        updated_at = NOW()'
      USING user_id_param, company_name_param, first_name_param, last_name_param, user_email, user_email, 'complete';
      
      company_profile_created := true;
    EXCEPTION
      WHEN OTHERS THEN
        PERFORM public.log_db_error('ensure_client_account_robust-company_profile', SQLERRM, jsonb_build_object('user_id', user_id_param));
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Failed to create company profile: ' || SQLERRM,
          'step', 'company_profile_creation'
        );
    END;
  END IF;
  
  -- Final verification
  IF public.is_client_account(user_id_param) THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Client account ensured successfully',
      'account_created', account_created,
      'profile_created', profile_created,
      'company_profile_created', company_profile_created,
      'is_client', true
    );
  ELSE
    PERFORM public.log_db_error('ensure_client_account_robust-verification', 'Verification failed after creation', jsonb_build_object('user_id', user_id_param));
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Client account verification failed after creation',
      'account_created', account_created,
      'profile_created', profile_created,
      'company_profile_created', company_profile_created,
      'is_client', false
    );
  END IF;
END;
$$;

-- 7. Add cleanup functions for expired sessions and tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Clean up expired OTP verifications
  DELETE FROM public.user_otp_verification 
  WHERE expires_at < NOW() - INTERVAL '1 hour';
  
  -- Clean up expired password resets
  DELETE FROM public.client_password_resets 
  WHERE expires_at < NOW() - INTERVAL '1 hour';
  
  -- Clean up expired email confirmations
  DELETE FROM public.client_email_confirmations 
  WHERE expires_at < NOW() - INTERVAL '1 hour';
  
  -- Clean up old rate limits
  DELETE FROM public.rate_limits 
  WHERE window_start < NOW() - INTERVAL '24 hours';
  
  -- Clean up old enhanced rate limits
  DELETE FROM public.enhanced_rate_limits 
  WHERE window_start < NOW() - INTERVAL '24 hours';
END;
$$;
