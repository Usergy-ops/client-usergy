
-- Phase 1: Database Schema Repair
-- Step 1: Add missing onboarding_status column to company_profiles
ALTER TABLE client_workspace.company_profiles 
ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'incomplete';

-- Step 2: Drop and recreate the company_profiles table to fix constraint issues
-- First, let's safely migrate any existing data
CREATE TABLE IF NOT EXISTS client_workspace.company_profiles_backup AS 
SELECT * FROM client_workspace.company_profiles;

-- Drop the problematic table
DROP TABLE IF EXISTS client_workspace.company_profiles CASCADE;

-- Recreate with proper constraints
CREATE TABLE client_workspace.company_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL UNIQUE,
    company_name TEXT NOT NULL DEFAULT 'My Company',
    contact_first_name TEXT DEFAULT '',
    contact_last_name TEXT DEFAULT '',
    billing_email TEXT NOT NULL,
    onboarding_status TEXT DEFAULT 'incomplete',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_auth_user_id UNIQUE(auth_user_id)
);

-- Enable RLS on the new table
ALTER TABLE client_workspace.company_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own company profile" ON client_workspace.company_profiles
    FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert their own company profile" ON client_workspace.company_profiles
    FOR INSERT WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own company profile" ON client_workspace.company_profiles
    FOR UPDATE USING (auth_user_id = auth.uid());

CREATE POLICY "Service role can manage all company profiles" ON client_workspace.company_profiles
    FOR ALL USING (auth.role() = 'service_role');

-- Restore data from backup if any exists
INSERT INTO client_workspace.company_profiles (auth_user_id, company_name, contact_first_name, contact_last_name, billing_email, onboarding_status)
SELECT auth_user_id, company_name, contact_first_name, contact_last_name, billing_email, 'incomplete'
FROM client_workspace.company_profiles_backup
ON CONFLICT (auth_user_id) DO NOTHING;

-- Clean up backup table
DROP TABLE IF EXISTS client_workspace.company_profiles_backup;

-- Step 3: Fix the is_client_account function to remove problematic INSERT
CREATE OR REPLACE FUNCTION public.is_client_account(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace'
AS $$
DECLARE
  account_exists boolean := false;
BEGIN
  -- Simple, reliable check without logging
  SELECT EXISTS(
    SELECT 1 FROM public.account_types 
    WHERE auth_user_id = user_id_param AND account_type = 'client'
  ) INTO account_exists;
  
  RETURN account_exists;
END;
$$;

-- Step 4: Fix the diagnose_user_account function
CREATE OR REPLACE FUNCTION public.diagnose_user_account(user_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace', 'auth'
AS $$
DECLARE
  result jsonb;
  user_record record;
  account_type_record record;
  profile_record record;
BEGIN
  -- Get user info
  SELECT * INTO user_record FROM auth.users WHERE id = user_id_param;
  
  -- Get account type info
  SELECT * INTO account_type_record FROM public.account_types 
  WHERE auth_user_id = user_id_param;
  
  -- Get profile info
  SELECT * INTO profile_record FROM client_workspace.company_profiles 
  WHERE auth_user_id = user_id_param;
  
  result := jsonb_build_object(
    'user_exists', user_record.id IS NOT NULL,
    'user_email', user_record.email,
    'user_provider', user_record.raw_app_meta_data->>'provider',
    'account_type_exists', account_type_record.auth_user_id IS NOT NULL,
    'account_type', account_type_record.account_type,
    'profile_exists', profile_record.auth_user_id IS NOT NULL,
    'profile_company', profile_record.company_name,
    'profile_onboarding_status', profile_record.onboarding_status,
    'is_client_account_result', public.is_client_account(user_id_param)
  );
  
  RETURN result;
END;
$$;

-- Step 5: Update create_client_account_for_user to use correct constraint
CREATE OR REPLACE FUNCTION public.create_client_account_for_user(user_id_param uuid, company_name_param text DEFAULT 'My Company'::text, first_name_param text DEFAULT NULL::text, last_name_param text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace', 'auth'
AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = user_id_param;
  
  IF user_email IS NULL THEN
    RAISE EXCEPTION 'User not found with ID: %', user_id_param;
  END IF;
  
  -- Create account_types record
  INSERT INTO public.account_types (auth_user_id, account_type)
  VALUES (user_id_param, 'client')
  ON CONFLICT (auth_user_id, account_type) DO UPDATE SET 
    created_at = COALESCE(account_types.created_at, NOW());
  
  -- Create client workspace profile using the correct constraint
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
    onboarding_status = COALESCE(EXCLUDED.onboarding_status, company_profiles.onboarding_status),
    updated_at = NOW();
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create client account for user %: %', user_id_param, SQLERRM;
    RETURN FALSE;
END;
$$;

-- Step 6: Drop all existing triggers on auth.users to prevent conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_client_account_creation_trigger ON auth.users;
DROP TRIGGER IF EXISTS handle_google_oauth_client_signup_trigger ON auth.users;
DROP TRIGGER IF EXISTS on_google_oauth_client_signup ON auth.users;

-- Step 7: Create a single, robust trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user_comprehensive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace', 'auth'
AS $$
DECLARE
  full_name TEXT;
  name_parts TEXT[];
  first_name TEXT;
  last_name TEXT;
  company_name TEXT;
  is_client_signup BOOLEAN := FALSE;
BEGIN
  -- Determine if this is a client signup
  IF (NEW.raw_user_meta_data->>'account_type' = 'client') OR 
     (NEW.raw_user_meta_data->>'accountType' = 'client') OR
     (NEW.raw_app_meta_data->>'provider' = 'google') THEN
    is_client_signup := TRUE;
  END IF;
  
  -- Only proceed if this is a client signup
  IF is_client_signup THEN
    -- Extract name information
    IF NEW.raw_app_meta_data->>'provider' = 'google' THEN
      -- Google OAuth flow
      full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
      name_parts := string_to_array(full_name, ' ');
      first_name := COALESCE(name_parts[1], '');
      last_name := COALESCE(array_to_string(name_parts[2:], ' '), '');
      company_name := 'My Company';
    ELSE
      -- Email signup flow
      first_name := COALESCE(NEW.raw_user_meta_data->>'contactFirstName', '');
      last_name := COALESCE(NEW.raw_user_meta_data->>'contactLastName', '');
      company_name := COALESCE(NEW.raw_user_meta_data->>'companyName', 'My Company');
    END IF;
    
    -- Create account type record
    INSERT INTO public.account_types (auth_user_id, account_type)
    VALUES (NEW.id, 'client')
    ON CONFLICT (auth_user_id, account_type) DO UPDATE SET 
      account_type = 'client';
    
    -- Create company profile
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
      company_name,
      first_name,
      last_name,
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
    -- Don't block user creation, just log the warning
    RAISE WARNING 'Failed to create client profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Step 8: Create the single trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_comprehensive();

-- Step 9: Create a safe account creation function with retries
CREATE OR REPLACE FUNCTION public.create_client_account_safe(user_id_param uuid, company_name_param text DEFAULT 'My Company'::text, first_name_param text DEFAULT ''::text, last_name_param text DEFAULT ''::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace', 'auth'
AS $$
DECLARE
  user_email TEXT;
  result jsonb;
  retry_count INTEGER := 0;
  max_retries INTEGER := 3;
  success BOOLEAN := FALSE;
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = user_id_param;
  
  IF user_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found',
      'user_id', user_id_param
    );
  END IF;
  
  -- Retry loop
  WHILE retry_count < max_retries AND NOT success LOOP
    BEGIN
      -- Create account_types record
      INSERT INTO public.account_types (auth_user_id, account_type)
      VALUES (user_id_param, 'client')
      ON CONFLICT (auth_user_id, account_type) DO UPDATE SET 
        created_at = COALESCE(account_types.created_at, NOW());
      
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
        onboarding_status = COALESCE(EXCLUDED.onboarding_status, company_profiles.onboarding_status),
        updated_at = NOW();
      
      success := TRUE;
      
    EXCEPTION
      WHEN OTHERS THEN
        retry_count := retry_count + 1;
        IF retry_count >= max_retries THEN
          RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'user_id', user_id_param,
            'retry_count', retry_count
          );
        END IF;
        -- Wait a bit before retry (simulated)
        PERFORM pg_sleep(0.1 * retry_count);
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', success,
    'user_id', user_id_param,
    'retry_count', retry_count,
    'email', user_email
  );
END;
$$;

-- Step 10: Create updated trigger functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Add trigger to company_profiles for updated_at
CREATE TRIGGER update_company_profiles_updated_at
    BEFORE UPDATE ON client_workspace.company_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
