
-- Step 1: Create missing database triggers for automatic client account creation
-- This ensures client accounts are created automatically when users sign up via client.usergy.ai

-- First, let's create a trigger that runs after user confirmation
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_confirmed_client_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'client_workflow', 'auth'
AS $$
DECLARE
  should_create_client BOOLEAN := false;
  provider TEXT;
  full_name TEXT;
  company_name_param TEXT;
  first_name TEXT := '';
  last_name TEXT := '';
  name_parts TEXT[];
BEGIN
  -- Only process when email is being confirmed for the first time
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    
    provider := NEW.raw_app_meta_data->>'provider';
    
    -- Determine if this should be a client account based on multiple signals
    -- Priority 1: Explicit client designation via metadata
    IF NEW.raw_user_meta_data->>'account_type' = 'client' OR
       NEW.raw_user_meta_data->>'accountType' = 'client' OR
       NEW.raw_user_meta_data->>'signup_source' = 'client_signup' THEN
      should_create_client := true;
    -- Priority 2: OAuth signups (Google, etc.) - default to client for client.usergy.ai
    ELSIF provider IN ('google', 'github', 'facebook') THEN
      should_create_client := true;
    -- Priority 3: Email domain or referrer-based detection
    ELSIF NEW.email LIKE '%@client.usergy.ai%' OR
          NEW.raw_user_meta_data->>'referrer_url' LIKE '%client.usergy.ai%' THEN
      should_create_client := true;
    -- Priority 4: Default fallback for client.usergy.ai signups
    ELSE
      should_create_client := true; -- Default to client for this portal
    END IF;
    
    -- Create client account if needed
    IF should_create_client THEN
      -- Extract company name
      company_name_param := COALESCE(
        NEW.raw_user_meta_data->>'companyName',
        NEW.raw_user_meta_data->>'company_name',
        'My Company'
      );
      
      -- Extract name information
      full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        CONCAT_WS(' ', 
          NEW.raw_user_meta_data->>'given_name', 
          NEW.raw_user_meta_data->>'family_name'
        ),
        ''
      );
      
      -- Parse first and last name
      IF full_name != '' THEN
        name_parts := string_to_array(full_name, ' ');
        first_name := COALESCE(name_parts[1], '');
        last_name := COALESCE(array_to_string(name_parts[2:], ' '), '');
      END IF;
      
      -- Override with explicit first/last names if provided
      first_name := COALESCE(
        NEW.raw_user_meta_data->>'firstName',
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'given_name',
        first_name
      );
      
      last_name := COALESCE(
        NEW.raw_user_meta_data->>'lastName',
        NEW.raw_user_meta_data->>'last_name',
        NEW.raw_user_meta_data->>'family_name',
        last_name
      );
      
      -- Create client record in client_workflow.clients
      INSERT INTO client_workflow.clients (
        auth_user_id,
        email,
        full_name,
        company_name,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        NEW.email,
        NULLIF(TRIM(CONCAT(first_name, ' ', last_name)), ''),
        company_name_param,
        NOW(),
        NOW()
      )
      ON CONFLICT (auth_user_id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, client_workflow.clients.full_name),
        company_name = COALESCE(EXCLUDED.company_name, client_workflow.clients.company_name),
        updated_at = NOW();
      
      -- Create account type record
      INSERT INTO public.account_types (
        auth_user_id,
        account_type,
        created_at
      ) VALUES (
        NEW.id,
        'client',
        NOW()
      )
      ON CONFLICT (auth_user_id) DO UPDATE SET
        account_type = 'client';
      
      -- Log successful client creation
      INSERT INTO public.error_logs (
        error_type,
        error_message,
        context,
        user_id,
        metadata
      ) VALUES (
        'info',
        'Client account created successfully via trigger',
        'handle_confirmed_client_signup',
        NEW.id,
        jsonb_build_object(
          'email', NEW.email,
          'provider', provider,
          'company_name', company_name_param,
          'full_name', NULLIF(TRIM(CONCAT(first_name, ' ', last_name)), '')
        )
      );
      
    END IF;
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
      'handle_confirmed_client_signup',
      NEW.id,
      jsonb_build_object(
        'email', NEW.email,
        'error_detail', SQLERRM,
        'should_create_client', should_create_client
      )
    );
    
    RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_confirmed_client_signup();

-- Step 2: Add profile completion enforcement for client_workspace.company_profiles
-- Add onboarding_status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'client_workspace' 
    AND table_name = 'company_profiles' 
    AND column_name = 'onboarding_status'
  ) THEN
    ALTER TABLE client_workspace.company_profiles 
    ADD COLUMN onboarding_status TEXT DEFAULT 'pending' CHECK (onboarding_status IN ('pending', 'completed'));
  END IF;
END $$;

-- Update existing records to have pending status
UPDATE client_workspace.company_profiles 
SET onboarding_status = 'pending' 
WHERE onboarding_status IS NULL;

-- Step 3: Create a function to validate profile completeness
CREATE OR REPLACE FUNCTION client_workspace.is_profile_complete(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile_record client_workspace.company_profiles%ROWTYPE;
BEGIN
  SELECT * INTO profile_record 
  FROM client_workspace.company_profiles 
  WHERE auth_user_id = user_id_param;
  
  -- Check if profile exists and has all required fields
  IF profile_record.auth_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Required fields for profile completion
  RETURN (
    profile_record.company_name IS NOT NULL AND profile_record.company_name != '' AND
    profile_record.industry IS NOT NULL AND profile_record.industry != '' AND
    profile_record.company_size IS NOT NULL AND profile_record.company_size != '' AND
    profile_record.contact_role IS NOT NULL AND profile_record.contact_role != '' AND
    profile_record.company_country IS NOT NULL AND profile_record.company_country != '' AND
    profile_record.company_city IS NOT NULL AND profile_record.company_city != '' AND
    profile_record.company_timezone IS NOT NULL AND profile_record.company_timezone != '' AND
    profile_record.onboarding_status = 'completed'
  );
END;
$$;

-- Step 4: Fix any existing users who should be client accounts but aren't
-- This handles any users who signed up before the trigger was in place
INSERT INTO client_workflow.clients (auth_user_id, email, company_name, created_at, updated_at)
SELECT 
  u.id, 
  u.email, 
  'My Company',
  u.created_at,
  NOW()
FROM auth.users u
LEFT JOIN client_workflow.clients c ON u.id = c.auth_user_id
WHERE u.email_confirmed_at IS NOT NULL 
  AND c.auth_user_id IS NULL
  AND u.id NOT IN (
    SELECT auth_user_id FROM public.account_types WHERE account_type = 'user'
  )
ON CONFLICT (auth_user_id) DO NOTHING;

-- Ensure account_types are set for these users
INSERT INTO public.account_types (auth_user_id, account_type, created_at)
SELECT 
  c.auth_user_id,
  'client',
  NOW()
FROM client_workflow.clients c
LEFT JOIN public.account_types at ON c.auth_user_id = at.auth_user_id
WHERE at.auth_user_id IS NULL
ON CONFLICT (auth_user_id) DO UPDATE SET account_type = 'client';
