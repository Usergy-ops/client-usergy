
-- STEP 1: Standardize on client_workspace schema (NOT client schema)
-- First, ensure client_workspace schema exists
CREATE SCHEMA IF NOT EXISTS client_workspace;

-- STEP 2: Drop ALL duplicate/conflicting triggers first to prevent issues
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_client ON auth.users;
DROP TRIGGER IF EXISTS handle_client_account_creation_trigger ON auth.users;
DROP TRIGGER IF EXISTS on_google_oauth_client_signup ON auth.users;
DROP TRIGGER IF EXISTS handle_google_oauth_client_signup_trigger ON auth.users;
DROP TRIGGER IF EXISTS on_google_oauth_user_created ON auth.users;

-- STEP 3: Backup existing data if any
CREATE TABLE IF NOT EXISTS client_workspace.company_profiles_backup AS 
SELECT * FROM client_workspace.company_profiles WHERE false; -- Structure only

-- Copy data if table exists
INSERT INTO client_workspace.company_profiles_backup
SELECT * FROM client_workspace.company_profiles
ON CONFLICT DO NOTHING;

-- STEP 4: Drop and recreate company_profiles with proper structure
DROP TABLE IF EXISTS client_workspace.company_profiles CASCADE;

CREATE TABLE client_workspace.company_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL DEFAULT 'My Company',
    contact_first_name TEXT DEFAULT '',
    contact_last_name TEXT DEFAULT '',
    contact_email TEXT,
    billing_email TEXT NOT NULL,
    onboarding_status TEXT DEFAULT 'incomplete',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STEP 5: Enable RLS
ALTER TABLE client_workspace.company_profiles ENABLE ROW LEVEL SECURITY;

-- STEP 6: Create clean RLS policies
CREATE POLICY "Users can view own profile" ON client_workspace.company_profiles
    FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON client_workspace.company_profiles
    FOR UPDATE USING (auth_user_id = auth.uid());

CREATE POLICY "Service role full access" ON client_workspace.company_profiles
    FOR ALL USING (auth.role() = 'service_role');

-- STEP 7: Restore data
INSERT INTO client_workspace.company_profiles 
SELECT * FROM client_workspace.company_profiles_backup
ON CONFLICT (auth_user_id) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    updated_at = NOW();

DROP TABLE IF EXISTS client_workspace.company_profiles_backup;

-- STEP 8: Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_company_profiles_auth_user_id ON client_workspace.company_profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_account_types_auth_user_id ON public.account_types(auth_user_id);

-- STEP 9: Fix account_types table constraints
-- First check current constraint
DO $$
BEGIN
    -- Drop incorrect constraints
    ALTER TABLE public.account_types DROP CONSTRAINT IF EXISTS account_types_auth_user_id_account_type_key;
    ALTER TABLE public.account_types DROP CONSTRAINT IF EXISTS account_types_auth_user_id_key;
    
    -- Add correct unique constraint on auth_user_id only
    ALTER TABLE public.account_types ADD CONSTRAINT account_types_auth_user_id_key UNIQUE (auth_user_id);
END $$;

-- FUNCTION 1: Simple, fast check if user is client (no logging)
CREATE OR REPLACE FUNCTION public.is_client_account(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM public.account_types 
    WHERE auth_user_id = user_id_param 
    AND account_type = 'client'
  );
END;
$$;

-- FUNCTION 2: Ensure client account exists (idempotent, with proper error handling)
CREATE OR REPLACE FUNCTION public.ensure_client_account(
  user_id_param uuid,
  company_name_param text DEFAULT 'My Company',
  first_name_param text DEFAULT '',
  last_name_param text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace', 'auth'
AS $$
DECLARE
  user_email TEXT;
  existing_account BOOLEAN;
  result jsonb;
BEGIN
  -- Check if already a client
  existing_account := public.is_client_account(user_id_param);
  
  IF existing_account THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Client account already exists',
      'is_client', true
    );
  END IF;
  
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = user_id_param;
  
  IF user_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found',
      'is_client', false
    );
  END IF;
  
  -- Start transaction-like behavior
  BEGIN
    -- Create account type
    INSERT INTO public.account_types (auth_user_id, account_type)
    VALUES (user_id_param, 'client')
    ON CONFLICT (auth_user_id) DO UPDATE 
    SET account_type = 'client';
    
    -- Create company profile
    INSERT INTO client_workspace.company_profiles (
      auth_user_id,
      company_name,
      contact_first_name,
      contact_last_name,
      billing_email,
      contact_email
    ) VALUES (
      user_id_param,
      company_name_param,
      first_name_param,
      last_name_param,
      user_email,
      user_email
    ) ON CONFLICT (auth_user_id) DO UPDATE SET
      company_name = CASE 
        WHEN company_profiles.company_name = 'My Company' AND EXCLUDED.company_name != 'My Company'
        THEN EXCLUDED.company_name
        ELSE company_profiles.company_name
      END,
      contact_first_name = CASE
        WHEN company_profiles.contact_first_name = '' AND EXCLUDED.contact_first_name != ''
        THEN EXCLUDED.contact_first_name
        ELSE company_profiles.contact_first_name
      END,
      contact_last_name = CASE
        WHEN company_profiles.contact_last_name = '' AND EXCLUDED.contact_last_name != ''
        THEN EXCLUDED.contact_last_name
        ELSE company_profiles.contact_last_name
      END,
      updated_at = NOW();
    
    -- Verify creation was successful
    IF public.is_client_account(user_id_param) THEN
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Client account created successfully',
        'is_client', true
      );
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Failed to create client account',
        'is_client', false
      );
    END IF;
    
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'is_client', false
      );
  END;
END;
$$;

-- FUNCTION 3: Single trigger for all user creation scenarios
CREATE OR REPLACE FUNCTION public.handle_new_user_unified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace', 'auth'
AS $$
DECLARE
  should_create_client BOOLEAN := false;
  provider TEXT;
  full_name TEXT;
  name_parts TEXT[];
  first_name TEXT := '';
  last_name TEXT := '';
BEGIN
  -- Determine if this should be a client account
  provider := NEW.raw_app_meta_data->>'provider';
  
  -- Check various conditions for client account creation
  IF NEW.raw_user_meta_data->>'account_type' = 'client' OR
     NEW.raw_user_meta_data->>'accountType' = 'client' OR
     provider = 'google' THEN
    should_create_client := true;
  END IF;
  
  -- Only create client account if needed
  IF should_create_client THEN
    -- Extract name information
    full_name := COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      ''
    );
    
    IF full_name != '' THEN
      name_parts := string_to_array(full_name, ' ');
      first_name := COALESCE(name_parts[1], '');
      last_name := COALESCE(array_to_string(name_parts[2:], ' '), '');
    END IF;
    
    -- Use the ensure function which handles conflicts properly
    PERFORM public.ensure_client_account(
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'company_name', 'My Company'),
      first_name,
      last_name
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block user creation
    RAISE WARNING 'Error in handle_new_user_unified: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create the single, unified trigger
CREATE TRIGGER on_auth_user_created_unified
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_unified();
