
-- Create client schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS client;

-- Create client_accounts table in client schema
CREATE TABLE IF NOT EXISTS client.client_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  contact_first_name TEXT,
  contact_last_name TEXT,
  contact_email TEXT NOT NULL,
  onboarding_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on client_accounts
ALTER TABLE client.client_accounts ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for client_accounts
CREATE POLICY "Users can manage their own client account"
ON client.client_accounts
FOR ALL
USING (auth_user_id = auth.uid());

-- Update the create_client_account_for_user function to use client schema
CREATE OR REPLACE FUNCTION public.create_client_account_for_user(
  user_id_param uuid, 
  company_name_param text DEFAULT 'My Company'::text, 
  first_name_param text DEFAULT NULL::text, 
  last_name_param text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client'
AS $function$
DECLARE
  user_email TEXT;
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = user_id_param;
  
  IF user_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Create account_types record
  INSERT INTO public.account_types (auth_user_id, account_type)
  VALUES (user_id_param, 'client')
  ON CONFLICT (auth_user_id) DO NOTHING;
  
  -- Create client account record
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
  ON CONFLICT (auth_user_id) DO NOTHING;
  
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
      'method', 'rpc_function'
    )
  );
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error
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
        'error_detail', SQLERRM
      )
    );
    
    RETURN FALSE;
END;
$function$;

-- Update the client user trigger to use client schema
CREATE OR REPLACE FUNCTION public.handle_new_client_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client'
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
    company_name := signup_data->>'company_name';
    first_name := signup_data->>'first_name';  
    last_name := signup_data->>'last_name';
  ELSIF signup_data ? 'provider' AND signup_data->>'provider' = 'google' THEN
    -- For Google OAuth, we'll handle client account creation in the application layer
    RETURN NEW;
  END IF;
  
  -- Only proceed if this is intended to be a client account
  IF is_client_account THEN
    -- Create account_types record
    INSERT INTO public.account_types (auth_user_id, account_type)
    VALUES (NEW.id, 'client')
    ON CONFLICT (auth_user_id) DO NOTHING;
    
    -- Create client account record
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
      COALESCE(company_name, 'Unnamed Company'),
      first_name,
      last_name, 
      NEW.email,
      'pending'
    )
    ON CONFLICT (auth_user_id) DO NOTHING;
    
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
        'signup_method', CASE WHEN signup_data ? 'provider' THEN signup_data->>'provider' ELSE 'email' END
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
        'user_metadata', signup_data
      )
    );
    
    RAISE WARNING 'Failed to create client records for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$function$;
