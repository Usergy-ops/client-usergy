
-- Migration: Client Authentication Cleanup
-- Generated: 2025-01-30
-- Description: Consolidate client authentication system, remove conflicting triggers, fix constraints

-- =============================================================================
-- PHASE 1: DROP EXISTING CONFLICTING TRIGGERS
-- =============================================================================

-- Drop all existing client authentication triggers
DROP TRIGGER IF EXISTS handle_new_user_account_type_assignment_trigger ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_unified_trigger ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_client_creation_trigger ON auth.users;
DROP TRIGGER IF EXISTS handle_google_oauth_client_signup_trigger ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_profile_creation_trigger ON auth.users;
DROP TRIGGER IF EXISTS handle_unified_user_signup_trigger ON auth.users;
DROP TRIGGER IF EXISTS handle_client_account_creation_trigger ON auth.users;

-- Drop functions that are no longer needed
DROP FUNCTION IF EXISTS public.handle_new_user_account_type_assignment();
DROP FUNCTION IF EXISTS public.handle_new_user_unified();
DROP FUNCTION IF EXISTS public.handle_new_user_client_creation();
DROP FUNCTION IF EXISTS public.handle_google_oauth_client_signup();
DROP FUNCTION IF EXISTS public.handle_new_user_profile_creation();
DROP FUNCTION IF EXISTS public.handle_unified_user_signup();
DROP FUNCTION IF EXISTS public.handle_client_account_creation();

-- =============================================================================
-- PHASE 2: ENSURE CLIENT_WORKSPACE SCHEMA EXISTS
-- =============================================================================

-- Create client_workspace schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS client_workspace;

-- =============================================================================
-- PHASE 3: FIX CONSTRAINTS ON ACCOUNT_TYPES
-- =============================================================================

-- Drop existing constraint if it exists and recreate with proper name
ALTER TABLE public.account_types DROP CONSTRAINT IF EXISTS account_types_auth_user_id_key;
ALTER TABLE public.account_types DROP CONSTRAINT IF EXISTS unique_auth_user_id_account_type;

-- Add unique constraint on auth_user_id only (one account type per user)
ALTER TABLE public.account_types ADD CONSTRAINT unique_auth_user_id UNIQUE (auth_user_id);

-- Make auth_user_id NOT NULL for RLS security
ALTER TABLE public.account_types ALTER COLUMN auth_user_id SET NOT NULL;

-- =============================================================================
-- PHASE 4: ENSURE COMPANY_PROFILES TABLE IS PROPERLY CONFIGURED
-- =============================================================================

-- Ensure company_profiles table exists with correct structure
CREATE TABLE IF NOT EXISTS client_workspace.company_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL,
  company_name TEXT NOT NULL DEFAULT 'My Company',
  contact_first_name TEXT DEFAULT '',
  contact_last_name TEXT DEFAULT '',
  contact_email TEXT,
  billing_email TEXT NOT NULL,
  onboarding_status TEXT DEFAULT 'incomplete' CHECK (onboarding_status IN ('incomplete', 'complete')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_auth_user_company_profile UNIQUE (auth_user_id)
);

-- Add RLS policies for company_profiles
ALTER TABLE client_workspace.company_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own company profile" ON client_workspace.company_profiles;
DROP POLICY IF EXISTS "Users can insert their own company profile" ON client_workspace.company_profiles;
DROP POLICY IF EXISTS "Users can update their own company profile" ON client_workspace.company_profiles;
DROP POLICY IF EXISTS "Service role can manage all company profiles" ON client_workspace.company_profiles;

-- Create RLS policies
CREATE POLICY "Users can view their own company profile"
  ON client_workspace.company_profiles FOR SELECT
  USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert their own company profile"
  ON client_workspace.company_profiles FOR INSERT
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own company profile"
  ON client_workspace.company_profiles FOR UPDATE
  USING (auth_user_id = auth.uid());

CREATE POLICY "Service role can manage all company profiles"
  ON client_workspace.company_profiles FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- PHASE 5: CREATE SIMPLIFIED CLIENT SIGNUP TRIGGER
-- =============================================================================

-- Create the single, simple trigger function
CREATE OR REPLACE FUNCTION public.handle_client_signup_simple()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace', 'auth'
AS $$
DECLARE
  full_name TEXT;
  name_parts TEXT[];
  first_name TEXT := '';
  last_name TEXT := '';
BEGIN
  -- Only process users with client metadata or Google OAuth
  IF (NEW.raw_user_meta_data->>'accountType' = 'client' OR 
      NEW.raw_user_meta_data->>'account_type' = 'client' OR
      NEW.raw_app_meta_data->>'provider' = 'google') THEN
    
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
    
    -- Use metadata if available, otherwise use extracted names
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
    
    -- Create account type record
    INSERT INTO public.account_types (auth_user_id, account_type)
    VALUES (NEW.id, 'client')
    ON CONFLICT (auth_user_id) DO UPDATE SET
      account_type = 'client',
      created_at = COALESCE(account_types.created_at, NOW());
    
    -- Create company profile
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
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'companyName', 'My Company'),
      first_name,
      last_name,
      NEW.email,
      NEW.email,
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
      updated_at = NOW();
    
    -- Log successful creation
    INSERT INTO public.error_logs (
      error_type,
      error_message,
      context,
      user_id,
      metadata
    ) VALUES (
      'info',
      'Client account created via simplified trigger',
      'handle_client_signup_simple',
      NEW.id,
      jsonb_build_object(
        'email', NEW.email,
        'company_name', COALESCE(NEW.raw_user_meta_data->>'companyName', 'My Company'),
        'provider', NEW.raw_app_meta_data->>'provider'
      )
    );
    
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
      'handle_client_signup_simple',
      NEW.id,
      jsonb_build_object(
        'error_detail', SQLERRM,
        'sql_state', SQLSTATE,
        'email', NEW.email
      )
    );
    
    RETURN NEW;
END;
$$;

-- Create the single trigger
CREATE TRIGGER handle_client_signup_simple_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_client_signup_simple();

-- =============================================================================
-- PHASE 6: UPDATE EXISTING HELPER FUNCTIONS
-- =============================================================================

-- Update the is_client_account function to be more reliable
CREATE OR REPLACE FUNCTION public.is_client_account(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM public.account_types 
    WHERE auth_user_id = user_id_param 
    AND account_type = 'client'
  );
END;
$$;

-- =============================================================================
-- PHASE 7: DATA MIGRATION (IF NEEDED)
-- =============================================================================

-- Migrate any existing client accounts that might not have proper records
INSERT INTO public.account_types (auth_user_id, account_type)
SELECT DISTINCT cp.auth_user_id, 'client'
FROM client_workspace.company_profiles cp
LEFT JOIN public.account_types at ON cp.auth_user_id = at.auth_user_id
WHERE at.auth_user_id IS NULL
ON CONFLICT (auth_user_id) DO UPDATE SET account_type = 'client';

-- =============================================================================
-- VERIFICATION QUERIES (Run these after migration to verify)
-- =============================================================================

-- Check trigger count (should show only 1 client trigger)
-- SELECT count(*) as client_triggers FROM information_schema.triggers 
-- WHERE trigger_name LIKE '%client%' AND event_object_schema = 'auth';

-- Check account_types constraints
-- SELECT conname, contype FROM pg_constraint 
-- WHERE conrelid = 'public.account_types'::regclass;

-- Check company_profiles RLS policies
-- SELECT schemaname, tablename, policyname, cmd, roles 
-- FROM pg_policies 
-- WHERE schemaname = 'client_workspace' AND tablename = 'company_profiles';

-- =============================================================================
-- ROLLBACK SQL (Keep as comments for emergency rollback)
-- =============================================================================

/*
-- ROLLBACK INSTRUCTIONS (Run these in reverse order if rollback is needed):

-- 1. Drop the new trigger
DROP TRIGGER IF EXISTS handle_client_signup_simple_trigger ON auth.users;
DROP FUNCTION IF EXISTS public.handle_client_signup_simple();

-- 2. Restore original constraints on account_types
ALTER TABLE public.account_types DROP CONSTRAINT IF EXISTS unique_auth_user_id;
ALTER TABLE public.account_types ADD CONSTRAINT unique_auth_user_id_account_type UNIQUE (auth_user_id, account_type);

-- 3. Drop RLS policies on company_profiles
DROP POLICY IF EXISTS "Users can view their own company profile" ON client_workspace.company_profiles;
DROP POLICY IF EXISTS "Users can insert their own company profile" ON client_workspace.company_profiles;
DROP POLICY IF EXISTS "Users can update their own company profile" ON client_workspace.company_profiles;
DROP POLICY IF EXISTS "Service role can manage all company profiles" ON client_workspace.company_profiles;

-- 4. Recreate previous triggers (would need to restore previous function definitions)
-- Note: This would require having the previous function definitions available

-- 5. Remove migrated data if needed
-- DELETE FROM public.account_types WHERE created_at > '[MIGRATION_TIMESTAMP]';
*/
