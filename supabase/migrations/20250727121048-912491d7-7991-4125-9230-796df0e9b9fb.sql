
-- Phase 1: Fix Database Schema Issues

-- First, let's fix the client_accounts table constraints and search path issues
-- We need to ensure proper foreign key constraints and unique constraints

-- Update the client_accounts table to ensure proper constraints
ALTER TABLE client.client_accounts 
DROP CONSTRAINT IF EXISTS client_accounts_auth_user_id_key,
ADD CONSTRAINT client_accounts_auth_user_id_unique UNIQUE (auth_user_id);

-- Ensure the contact_email has proper constraint
ALTER TABLE client.client_accounts 
DROP CONSTRAINT IF EXISTS client_accounts_contact_email_key,
ADD CONSTRAINT client_accounts_contact_email_unique UNIQUE (contact_email);

-- Fix the create_client_account_for_user function with proper search path
CREATE OR REPLACE FUNCTION public.create_client_account_for_user(
  user_id_param uuid, 
  company_name_param text DEFAULT 'My Company'::text, 
  first_name_param text DEFAULT NULL::text, 
  last_name_param text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client', 'auth'
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
  ON CONFLICT (auth_user_id) DO UPDATE SET account_type = 'client';
  
  -- Create client account record with proper schema reference
  INSERT INTO client.client_accounts (
    auth_user_id, 
    company_name, 
    contact_first_name, 
    contact_last_name, 
    contact_email,
    onboarding_status
  )
  VALUES (
    user_id_param, 
    company_name_param,
    first_name_param,
    last_name_param, 
    user_email,
    'pending'
  )
  ON CONFLICT (auth_user_id) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    contact_first_name = EXCLUDED.contact_first_name,
    contact_last_name = EXCLUDED.contact_last_name,
    contact_email = EXCLUDED.contact_email,
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

-- Fix the handle_new_client_user trigger function with proper search path
CREATE OR REPLACE FUNCTION public.handle_new_client_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client', 'auth'
AS $function$
DECLARE
  signup_data JSONB;
  company_name TEXT;
  first_name TEXT;
  last_name TEXT;
  is_client_account BOOLEAN := FALSE;
BEGIN
  -- Extract user metadata
  signup_data := NEW.raw_user_meta_data;
  
  -- Check if this should be a client account
  IF signup_data ? 'account_type' AND signup_data->>'account_type' = 'client' THEN
    is_client_account := TRUE;
    company_name := COALESCE(signup_data->>'company_name', signup_data->>'companyName', 'My Company');
    first_name := COALESCE(signup_data->>'first_name', signup_data->>'contactFirstName', signup_data->>'firstName');
    last_name := COALESCE(signup_data->>'last_name', signup_data->>'contactLastName', signup_data->>'lastName');
  ELSIF signup_data ? 'provider' AND signup_data->>'provider' = 'google' THEN
    -- For Google OAuth, we'll handle client account creation in the application layer
    RETURN NEW;
  ELSIF signup_data ? 'companyName' THEN
    -- Handle direct company name field
    is_client_account := TRUE;
    company_name := signup_data->>'companyName';
    first_name := COALESCE(signup_data->>'contactFirstName', signup_data->>'firstName');
    last_name := COALESCE(signup_data->>'contactLastName', signup_data->>'lastName');
  END IF;
  
  -- Only proceed if this is intended to be a client account
  IF is_client_account THEN
    -- Create account_types record
    INSERT INTO public.account_types (auth_user_id, account_type)
    VALUES (NEW.id, 'client')
    ON CONFLICT (auth_user_id) DO UPDATE SET account_type = 'client';
    
    -- Create client account record with proper schema reference
    INSERT INTO client.client_accounts (
      auth_user_id, 
      company_name, 
      contact_first_name, 
      contact_last_name, 
      contact_email,
      onboarding_status
    )
    VALUES (
      NEW.id, 
      COALESCE(company_name, 'My Company'),
      first_name,
      last_name, 
      NEW.email,
      'pending'
    )
    ON CONFLICT (auth_user_id) DO UPDATE SET
      company_name = EXCLUDED.company_name,
      contact_first_name = EXCLUDED.contact_first_name,
      contact_last_name = EXCLUDED.contact_last_name,
      contact_email = EXCLUDED.contact_email,
      updated_at = NOW();
    
    -- Log successful client account creation
    INSERT INTO public.error_logs (
      error_type,
      error_message,
      context,
      user_id,
      metadata
    ) VALUES (
      'info',
      'Client account created successfully via trigger',
      'handle_new_client_user_trigger',
      NEW.id,
      jsonb_build_object(
        'company_name', company_name,
        'signup_method', CASE WHEN signup_data ? 'provider' THEN signup_data->>'provider' ELSE 'email' END,
        'email', NEW.email
      )
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    INSERT INTO public.error_logs (
      error_type,
      error_message,
      error_stack,
      context,
      user_id,
      metadata
    ) VALUES (
      'database_trigger_error',
      SQLERRM,
      SQLSTATE,
      'handle_new_client_user_trigger',
      NEW.id,
      jsonb_build_object(
        'error_detail', SQLERRM,
        'sql_state', SQLSTATE,
        'user_metadata', signup_data,
        'email', NEW.email
      )
    );
    
    RAISE WARNING 'Failed to create client records for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$function$;

-- Ensure RLS policies are correct for client_accounts
-- Drop existing policies and recreate them
DROP POLICY IF EXISTS "Service role can manage client accounts" ON client.client_accounts;
DROP POLICY IF EXISTS "Users can view their own client account" ON client.client_accounts;
DROP POLICY IF EXISTS "Users can update their own client account" ON client.client_accounts;

-- Create comprehensive RLS policies for client_accounts
CREATE POLICY "Service role can manage client accounts" 
ON client.client_accounts FOR ALL 
USING (auth.role() = 'service_role'::text);

CREATE POLICY "Users can view their own client account" 
ON client.client_accounts FOR SELECT 
USING (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own client account" 
ON client.client_accounts FOR UPDATE 
USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert their own client account" 
ON client.client_accounts FOR INSERT 
WITH CHECK (auth_user_id = auth.uid());

-- Ensure the trigger is properly attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_client_user();

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_client_accounts_auth_user_id ON client.client_accounts(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_account_types_auth_user_id ON public.account_types(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_account_types_account_type ON public.account_types(account_type);
