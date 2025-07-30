
-- PHASE 1: Database Schema Cleanup and Fixes
-- This comprehensive migration addresses all identified issues in the client authentication workflow

-- Step 1: Drop conflicting triggers that cause loops and conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;
DROP TRIGGER IF EXISTS handle_google_oauth_trigger ON auth.users;
DROP TRIGGER IF EXISTS handle_unified_signup_trigger ON auth.users;

-- Step 2: Remove duplicate/conflicting functions
DROP FUNCTION IF EXISTS public.handle_client_account_creation();
DROP FUNCTION IF EXISTS public.handle_new_user_unified();
DROP FUNCTION IF EXISTS public.handle_google_oauth_client_signup();
DROP FUNCTION IF EXISTS public.handle_unified_user_signup();
DROP FUNCTION IF EXISTS public.handle_new_user_client_creation();

-- Step 3: Fix account_types table constraints
-- First, let's check and fix the unique constraint
ALTER TABLE public.account_types DROP CONSTRAINT IF EXISTS account_types_auth_user_id_account_type_key;
ALTER TABLE public.account_types DROP CONSTRAINT IF EXISTS account_types_auth_user_id_key;

-- Add the correct unique constraint on auth_user_id only (one account type per user)
ALTER TABLE public.account_types ADD CONSTRAINT account_types_auth_user_id_key UNIQUE (auth_user_id);

-- Make auth_user_id NOT NULL for data integrity
ALTER TABLE public.account_types ALTER COLUMN auth_user_id SET NOT NULL;

-- Step 4: Fix client_workspace.company_profiles constraints
-- Ensure auth_user_id is NOT NULL and unique
ALTER TABLE client_workspace.company_profiles ALTER COLUMN auth_user_id SET NOT NULL;

-- Step 5: Create the unified, robust account creation function
CREATE OR REPLACE FUNCTION public.create_client_account_unified(
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
  user_email text;
  user_exists boolean;
  result jsonb;
BEGIN
  -- Validate user exists
  SELECT email INTO user_email 
  FROM auth.users 
  WHERE id = user_id_param;
  
  user_exists := (user_email IS NOT NULL);
  
  IF NOT user_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found',
      'is_client_account', false
    );
  END IF;
  
  -- Create account type record (upsert to handle conflicts)
  INSERT INTO public.account_types (auth_user_id, account_type)
  VALUES (user_id_param, 'client')
  ON CONFLICT (auth_user_id) DO UPDATE SET
    account_type = 'client',
    created_at = COALESCE(account_types.created_at, NOW());
  
  -- Create company profile (upsert to handle conflicts)
  INSERT INTO client_workspace.company_profiles (
    auth_user_id,
    company_name,
    contact_first_name,
    contact_last_name,
    billing_email,
    contact_email,
    onboarding_status
  )
  VALUES (
    user_id_param,
    CASE WHEN company_name_param = '' THEN 'My Company' ELSE company_name_param END,
    first_name_param,
    last_name_param,
    user_email,
    user_email,
    'incomplete'
  )
  ON CONFLICT (auth_user_id) DO UPDATE SET
    company_name = CASE 
      WHEN EXCLUDED.company_name != 'My Company' AND EXCLUDED.company_name != ''
      THEN EXCLUDED.company_name
      ELSE company_profiles.company_name
    END,
    contact_first_name = CASE
      WHEN EXCLUDED.contact_first_name != ''
      THEN EXCLUDED.contact_first_name
      ELSE company_profiles.contact_first_name
    END,
    contact_last_name = CASE
      WHEN EXCLUDED.contact_last_name != ''
      THEN EXCLUDED.contact_last_name
      ELSE company_profiles.contact_last_name
    END,
    billing_email = COALESCE(EXCLUDED.billing_email, company_profiles.billing_email),
    contact_email = COALESCE(EXCLUDED.contact_email, company_profiles.contact_email),
    updated_at = NOW();
  
  -- Verify account creation was successful
  IF public.is_client_account(user_id_param) THEN
    -- Log successful creation
    INSERT INTO public.error_logs (
      error_type,
      error_message,
      context,
      user_id,
      metadata
    ) VALUES (
      'info',
      'Client account created successfully via unified function',
      'create_client_account_unified',
      user_id_param,
      jsonb_build_object(
        'company_name', company_name_param,
        'first_name', first_name_param,
        'last_name', last_name_param,
        'email', user_email,
        'method', 'unified_function'
      )
    );
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Client account created successfully',
      'is_client_account', true
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to verify client account creation',
      'is_client_account', false
    );
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error with full details
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
      'create_client_account_unified',
      user_id_param,
      jsonb_build_object(
        'company_name', company_name_param,
        'first_name', first_name_param,
        'last_name', last_name_param,
        'email', user_email,
        'error_detail', SQLERRM,
        'sql_state', SQLSTATE
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'is_client_account', false
    );
END;
$$;

-- Step 6: Update the ensure_client_account_robust function to use the new unified function
CREATE OR REPLACE FUNCTION public.ensure_client_account_robust(
  user_id_param uuid,
  company_name_param text DEFAULT 'My Company',
  first_name_param text DEFAULT '',
  last_name_param text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Simply call the new unified function
  RETURN public.create_client_account_unified(
    user_id_param,
    company_name_param,
    first_name_param,
    last_name_param
  );
END;
$$;

-- Step 7: Create a single, reliable trigger for client account creation
CREATE OR REPLACE FUNCTION public.handle_client_signup_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'client_workspace', 'auth'
AS $$
DECLARE
  full_name text;
  name_parts text[];
  first_name text := '';
  last_name text := '';
  should_create_client boolean := false;
  provider text;
BEGIN
  -- Determine if this should be a client account
  provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
  
  -- Check conditions for client account creation
  IF NEW.raw_user_meta_data->>'account_type' = 'client' OR
     NEW.raw_user_meta_data->>'accountType' = 'client' OR
     provider = 'google' THEN
    should_create_client := true;
  END IF;
  
  -- Only create client account if conditions are met
  IF should_create_client THEN
    -- Extract name information
    full_name := COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      ''
    );
    
    -- Parse name if available
    IF full_name != '' THEN
      name_parts := string_to_array(full_name, ' ');
      first_name := COALESCE(name_parts[1], '');
      last_name := COALESCE(array_to_string(name_parts[2:], ' '), '');
    END IF;
    
    -- Use metadata if available, otherwise use parsed names
    first_name := COALESCE(
      NEW.raw_user_meta_data->>'contactFirstName',
      NEW.raw_user_meta_data->>'first_name',
      first_name
    );
    
    last_name := COALESCE(
      NEW.raw_user_meta_data->>'contactLastName',
      NEW.raw_user_meta_data->>'last_name',
      last_name
    );
    
    -- Create client account using the unified function
    PERFORM public.create_client_account_unified(
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'companyName', 'My Company'),
      first_name,
      last_name
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but never block user creation
    INSERT INTO public.error_logs (
      error_type,
      error_message,
      error_stack,
      context,
      user_id,
      metadata
    ) VALUES (
      'client_signup_trigger_error',
      SQLERRM,
      SQLSTATE,
      'handle_client_signup_trigger',
      NEW.id,
      jsonb_build_object(
        'email', NEW.email,
        'provider', provider,
        'error_detail', SQLERRM,
        'sql_state', SQLSTATE
      )
    );
    
    RETURN NEW;
END;
$$;

-- Step 8: Create the new trigger
CREATE TRIGGER client_signup_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_client_signup_trigger();

-- Step 9: Create enhanced diagnostic function
CREATE OR REPLACE FUNCTION public.diagnose_client_account_comprehensive(user_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'client_workspace', 'auth'
AS $$
DECLARE
  user_record record;
  account_type_record record;
  profile_record record;
  result jsonb;
  issues text[] := ARRAY[]::text[];
  recommendations text[] := ARRAY[]::text[];
BEGIN
  -- Get user info
  SELECT * INTO user_record FROM auth.users WHERE id = user_id_param;
  
  -- Get account type info
  SELECT * INTO account_type_record FROM public.account_types 
  WHERE auth_user_id = user_id_param;
  
  -- Get profile info
  SELECT * INTO profile_record FROM client_workspace.company_profiles 
  WHERE auth_user_id = user_id_param;
  
  -- Identify issues and provide recommendations
  IF user_record.id IS NULL THEN
    issues := array_append(issues, 'User does not exist in auth.users table');
    recommendations := array_append(recommendations, 'Verify the user ID is correct');
  END IF;
  
  IF account_type_record.auth_user_id IS NULL THEN
    issues := array_append(issues, 'No account type record found');
    recommendations := array_append(recommendations, 'Run ensure_client_account_robust function');
  ELSIF account_type_record.account_type != 'client' THEN
    issues := array_append(issues, 'Account type is not set to client');
    recommendations := array_append(recommendations, 'Update account type to client');
  END IF;
  
  IF profile_record.auth_user_id IS NULL THEN
    issues := array_append(issues, 'No client profile found');
    recommendations := array_append(recommendations, 'Create client profile in client_workspace schema');
  END IF;
  
  -- Build comprehensive result
  result := jsonb_build_object(
    'user_id', user_id_param,
    'user_exists', user_record.id IS NOT NULL,
    'user_email', user_record.email,
    'user_provider', user_record.raw_app_meta_data->>'provider',
    'user_confirmed', user_record.email_confirmed_at IS NOT NULL,
    'account_type_exists', account_type_record.auth_user_id IS NOT NULL,
    'account_type', account_type_record.account_type,
    'profile_exists', profile_record.auth_user_id IS NOT NULL,
    'profile_company', profile_record.company_name,
    'profile_status', profile_record.onboarding_status,
    'is_client_account', public.is_client_account(user_id_param),
    'issues', issues,
    'recommendations', recommendations,
    'diagnosis_timestamp', NOW()
  );
  
  -- Log diagnostic results
  INSERT INTO public.error_logs (
    error_type,
    error_message,
    context,
    user_id,
    metadata
  ) VALUES (
    'diagnostic',
    'Comprehensive client account diagnostic performed',
    'diagnose_client_account_comprehensive',
    user_id_param,
    result
  );
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    -- Return error information
    RETURN jsonb_build_object(
      'user_id', user_id_param,
      'user_exists', false,
      'error', SQLERRM,
      'sql_state', SQLSTATE,
      'diagnosis_timestamp', NOW()
    );
END;
$$;

-- Step 10: Update RLS policies for better security
-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can view their own account type" ON public.account_types;
DROP POLICY IF EXISTS "Service role can manage account types" ON public.account_types;

-- Create comprehensive RLS policies for account_types
CREATE POLICY "Users can view their own account type" 
  ON public.account_types FOR SELECT 
  USING (auth_user_id = auth.uid());

CREATE POLICY "Service role can manage all account types" 
  ON public.account_types FOR ALL 
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can insert their own account type" 
  ON public.account_types FOR INSERT 
  WITH CHECK (auth_user_id = auth.uid());

-- Step 11: Clean up old/unused functions while preserving essential ones
-- Keep the essential functions but ensure they're optimized
CREATE OR REPLACE FUNCTION public.get_client_account_status(user_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Use the comprehensive diagnostic function
  RETURN public.diagnose_client_account_comprehensive(user_id_param);
END;
$$;
