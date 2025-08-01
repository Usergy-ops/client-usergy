
-- Step 1: Database Cleanup - Consolidate OTP tables and triggers

-- First, migrate any existing data from client_workflow.otp_verifications to public.auth_otp_verifications
INSERT INTO public.auth_otp_verifications (email, otp_code, expires_at, verified_at, created_at, attempts, account_type, source_url, metadata)
SELECT 
  email, 
  otp_code, 
  expires_at, 
  verified_at, 
  created_at, 
  0 as attempts,
  'client' as account_type,
  'https://client.usergy.ai' as source_url,
  '{}'::jsonb as metadata
FROM client_workflow.otp_verifications
WHERE NOT EXISTS (
  SELECT 1 FROM public.auth_otp_verifications 
  WHERE public.auth_otp_verifications.email = client_workflow.otp_verifications.email
    AND public.auth_otp_verifications.otp_code = client_workflow.otp_verifications.otp_code
);

-- Drop the redundant client_workflow.otp_verifications table
DROP TABLE IF EXISTS client_workflow.otp_verifications;

-- Drop redundant auth triggers - keep only the most robust one
DROP TRIGGER IF EXISTS handle_new_user_account_type_assignment_trigger ON auth.users;
DROP TRIGGER IF EXISTS assign_account_type_on_signup_trigger ON auth.users;
DROP TRIGGER IF EXISTS handle_client_user_signup_trigger ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_profile_creation_trigger ON auth.users;

-- Create a single, unified auth trigger that handles both user and client account creation
CREATE OR REPLACE FUNCTION public.handle_unified_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workflow', 'auth'
AS $function$
DECLARE
  account_type_detected TEXT := 'client';
  company_name_param TEXT;
  first_name TEXT := '';
  last_name TEXT := '';
  full_name TEXT := '';
  name_parts TEXT[];
BEGIN
  -- Only process confirmed users (email confirmed or OAuth)
  IF NEW.email_confirmed_at IS NOT NULL OR 
     NEW.raw_app_meta_data->>'provider' IN ('google', 'github', 'facebook') THEN
    
    -- Determine account type based on multiple signals
    IF NEW.raw_user_meta_data->>'account_type' = 'user' OR
       NEW.email LIKE '%@user.usergy.ai%' THEN
      account_type_detected := 'user';
    ELSE
      account_type_detected := 'client';
    END IF;
    
    -- Create account type record
    INSERT INTO public.account_types (
      auth_user_id,
      account_type,
      created_at
    ) VALUES (
      NEW.id,
      account_type_detected,
      NOW()
    )
    ON CONFLICT (auth_user_id) DO UPDATE SET
      account_type = account_type_detected;
    
    -- Handle account-specific setup
    IF account_type_detected = 'user' THEN
      -- Create user profile
      full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        'User'
      );
      
      INSERT INTO public.profiles (user_id, email, full_name, completion_percentage)
      VALUES (NEW.id, NEW.email, full_name, 0)
      ON CONFLICT (user_id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        updated_at = NOW();
        
    ELSIF account_type_detected = 'client' THEN
      -- Extract company and name information
      company_name_param := COALESCE(
        NEW.raw_user_meta_data->>'companyName',
        NEW.raw_user_meta_data->>'company_name',
        'My Company'
      );
      
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
      
      -- Create client record
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
    END IF;
    
    -- Log successful account creation
    INSERT INTO public.error_logs (
      error_type,
      error_message,
      context,
      user_id,
      metadata
    ) VALUES (
      'info',
      'Unified account created successfully',
      'handle_unified_user_signup',
      NEW.id,
      jsonb_build_object(
        'email', NEW.email,
        'account_type', account_type_detected,
        'provider', NEW.raw_app_meta_data->>'provider',
        'company_name', company_name_param
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
      'unified_signup_trigger_error',
      SQLERRM,
      'handle_unified_user_signup',
      NEW.id,
      jsonb_build_object(
        'email', NEW.email,
        'error_detail', SQLERRM,
        'account_type_detected', account_type_detected
      )
    );
    
    RETURN NEW;
END;
$function$;

-- Create the single unified trigger
CREATE TRIGGER unified_user_signup_trigger
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_unified_user_signup();

-- Add missing RLS policies for the consolidated OTP table
CREATE POLICY "Service role can manage unified OTP verifications" 
  ON public.auth_otp_verifications 
  FOR ALL 
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

-- Update supabase config to disable JWT verification for unified-auth function
ALTER TABLE public.auth_otp_verifications ADD COLUMN IF NOT EXISTS blocked_until timestamp with time zone;
ALTER TABLE public.auth_otp_verifications ADD COLUMN IF NOT EXISTS email_sent boolean DEFAULT false;
ALTER TABLE public.auth_otp_verifications ADD COLUMN IF NOT EXISTS email_error text;
