
-- Phase 1: Database Schema Cleanup

-- Drop the unused client_workspace schema and all its contents
DROP SCHEMA IF EXISTS client_workspace CASCADE;

-- Remove unused/redundant database functions
DROP FUNCTION IF EXISTS public.assign_account_type_unified() CASCADE;
DROP FUNCTION IF EXISTS public.fix_incorrect_account_types() CASCADE;
DROP FUNCTION IF EXISTS public.ensure_profile_exists(uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.ensure_client_account_robust(uuid, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.manually_assign_account_type(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_debug_info(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.test_email_configuration() CASCADE;
DROP FUNCTION IF EXISTS public.validate_password_requirements(text) CASCADE;
DROP FUNCTION IF EXISTS public.update_rate_limits_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.check_email_exists_for_account_type(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_expired_unified_otp() CASCADE;
DROP FUNCTION IF EXISTS public.monitor_account_type_coverage() CASCADE;
DROP FUNCTION IF EXISTS public.fix_account_type_mismatches() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_old_enhanced_rate_limits() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_old_error_logs() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_rate_limits() CASCADE;
DROP FUNCTION IF EXISTS public.validate_password_strength(text) CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.update_profile_completion() CASCADE;
DROP FUNCTION IF EXISTS public.calculate_profile_completion(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_expired_otp() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_old_rate_limits() CASCADE;

-- Drop unused tables that are no longer needed
DROP TABLE IF EXISTS public.enhanced_rate_limits CASCADE;
DROP TABLE IF EXISTS public.rate_limits CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.auth_monitoring CASCADE;

-- Update the client_workflow.clients table to ensure it has all necessary fields
-- Add any missing columns that might be needed
ALTER TABLE client_workflow.clients 
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS company_website text,
ADD COLUMN IF NOT EXISTS contact_phone text,
ADD COLUMN IF NOT EXISTS company_country text,
ADD COLUMN IF NOT EXISTS company_city text,
ADD COLUMN IF NOT EXISTS company_timezone text,
ADD COLUMN IF NOT EXISTS company_logo_url text,
ADD COLUMN IF NOT EXISTS onboarding_status text DEFAULT 'pending';

-- Ensure RLS is properly configured for client_workflow.clients
ALTER TABLE client_workflow.clients ENABLE ROW LEVEL SECURITY;

-- Update RLS policies for client_workflow.clients
DROP POLICY IF EXISTS "Users can manage their own client data" ON client_workflow.clients;
CREATE POLICY "Users can manage their own client data" 
  ON client_workflow.clients 
  FOR ALL 
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- Create a simple account type assignment trigger
CREATE OR REPLACE FUNCTION public.assign_account_type_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Determine account type based on email domain or metadata
  DECLARE
    account_type_value text := 'client'; -- Default to client
  BEGIN
    -- Check explicit metadata first
    IF NEW.raw_user_meta_data->>'account_type' IN ('user', 'client') THEN
      account_type_value := NEW.raw_user_meta_data->>'account_type';
    -- Check email domain patterns
    ELSIF NEW.email LIKE '%@user.usergy.ai' OR NEW.email LIKE '%user.usergy.ai%' THEN
      account_type_value := 'user';
    ELSIF NEW.email LIKE '%@client.usergy.ai' OR NEW.email LIKE '%client.usergy.ai%' THEN
      account_type_value := 'client';
    -- Check source URL patterns
    ELSIF NEW.raw_user_meta_data->>'source_url' LIKE '%user.usergy.ai%' THEN
      account_type_value := 'user';
    END IF;
    
    -- Insert account type
    INSERT INTO public.account_types (auth_user_id, account_type)
    VALUES (NEW.id, account_type_value)
    ON CONFLICT (auth_user_id) DO UPDATE SET
      account_type = account_type_value,
      created_at = CURRENT_TIMESTAMP;
      
    RETURN NEW;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic account type assignment
DROP TRIGGER IF EXISTS assign_account_type_trigger ON auth.users;
CREATE TRIGGER assign_account_type_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_account_type_on_signup();

-- Clean up old OTP verification records
DELETE FROM public.auth_otp_verifications 
WHERE expires_at < NOW() - INTERVAL '24 hours';

-- Add cleanup job for expired OTP records
CREATE OR REPLACE FUNCTION public.cleanup_expired_auth_otp()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.auth_otp_verifications 
  WHERE expires_at < NOW() 
    AND (verified_at IS NULL OR verified_at < NOW() - INTERVAL '1 hour');
END;
$$;
