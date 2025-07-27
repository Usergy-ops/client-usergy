
-- First, let's add better error handling and logging to the client account creation function
CREATE OR REPLACE FUNCTION public.create_client_account_for_user(
  user_id_param uuid, 
  company_name_param text DEFAULT 'My Company'::text, 
  first_name_param text DEFAULT NULL::text, 
  last_name_param text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace', 'auth'
AS $$
DECLARE
  user_email TEXT;
  result jsonb;
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = user_id_param;
  
  IF user_email IS NULL THEN
    result := jsonb_build_object(
      'success', false,
      'error', 'User not found',
      'user_id', user_id_param
    );
    
    -- Log the error
    INSERT INTO public.error_logs (
      error_type, error_message, context, user_id, metadata
    ) VALUES (
      'client_account_creation_error',
      'User not found with ID: ' || user_id_param,
      'create_client_account_for_user',
      user_id_param,
      jsonb_build_object('step', 'user_lookup', 'user_id', user_id_param)
    );
    
    RETURN result;
  END IF;
  
  -- Create account_types record first with detailed logging
  BEGIN
    INSERT INTO public.account_types (auth_user_id, account_type)
    VALUES (user_id_param, 'client')
    ON CONFLICT (auth_user_id) DO UPDATE SET 
      account_type = 'client',
      created_at = CURRENT_TIMESTAMP;
    
    -- Log successful account type creation
    INSERT INTO public.error_logs (
      error_type, error_message, context, user_id, metadata
    ) VALUES (
      'info',
      'Account type created/updated successfully',
      'create_client_account_for_user',
      user_id_param,
      jsonb_build_object('step', 'account_type', 'email', user_email)
    );
    
  EXCEPTION WHEN OTHERS THEN
    result := jsonb_build_object(
      'success', false,
      'error', 'Failed to create account type: ' || SQLERRM,
      'user_id', user_id_param
    );
    
    INSERT INTO public.error_logs (
      error_type, error_message, error_stack, context, user_id, metadata
    ) VALUES (
      'client_account_creation_error',
      'Failed to create account type: ' || SQLERRM,
      SQLSTATE,
      'create_client_account_for_user',
      user_id_param,
      jsonb_build_object('step', 'account_type', 'email', user_email)
    );
    
    RETURN result;
  END;
  
  -- Create client workspace profile with detailed logging
  BEGIN
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
      company_name = EXCLUDED.company_name,
      contact_first_name = EXCLUDED.contact_first_name,
      contact_last_name = EXCLUDED.contact_last_name,
      billing_email = EXCLUDED.billing_email,
      updated_at = NOW();
    
    -- Log successful profile creation
    INSERT INTO public.error_logs (
      error_type, error_message, context, user_id, metadata
    ) VALUES (
      'info',
      'Client workspace profile created/updated successfully',
      'create_client_account_for_user',
      user_id_param,
      jsonb_build_object('step', 'workspace_profile', 'email', user_email)
    );
    
  EXCEPTION WHEN OTHERS THEN
    result := jsonb_build_object(
      'success', false,
      'error', 'Failed to create workspace profile: ' || SQLERRM,
      'user_id', user_id_param
    );
    
    INSERT INTO public.error_logs (
      error_type, error_message, error_stack, context, user_id, metadata
    ) VALUES (
      'client_account_creation_error',
      'Failed to create workspace profile: ' || SQLERRM,
      SQLSTATE,
      'create_client_account_for_user',
      user_id_param,
      jsonb_build_object('step', 'workspace_profile', 'email', user_email)
    );
    
    RETURN result;
  END;
  
  -- Return success
  result := jsonb_build_object(
    'success', true,
    'message', 'Client account created successfully',
    'user_id', user_id_param,
    'email', user_email
  );
  
  -- Log final success
  INSERT INTO public.error_logs (
    error_type, error_message, context, user_id, metadata
  ) VALUES (
    'info',
    'Client account creation completed successfully',
    'create_client_account_for_user',
    user_id_param,
    jsonb_build_object('email', user_email, 'company_name', company_name_param)
  );
  
  RETURN result;
END;
$$;

-- Create a function to check if a user has a client account with better error handling
CREATE OR REPLACE FUNCTION public.check_user_is_client(user_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  account_record record;
  result jsonb;
BEGIN
  -- Check if user exists in account_types with client type
  SELECT * INTO account_record 
  FROM public.account_types 
  WHERE auth_user_id = user_id_param AND account_type = 'client';
  
  IF FOUND THEN
    result := jsonb_build_object(
      'is_client', true,
      'user_id', user_id_param,
      'created_at', account_record.created_at
    );
  ELSE
    result := jsonb_build_object(
      'is_client', false,
      'user_id', user_id_param,
      'message', 'User is not a client account'
    );
  END IF;
  
  RETURN result;
END;
$$;

-- Add a trigger to automatically create client accounts for Google OAuth users
CREATE OR REPLACE FUNCTION public.handle_google_oauth_client_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace', 'auth'
AS $$
DECLARE
  is_google_oauth boolean;
  user_name_parts text[];
  first_name text;
  last_name text;
  creation_result jsonb;
BEGIN
  -- Check if this is a Google OAuth signup
  is_google_oauth := (NEW.app_metadata->>'provider' = 'google');
  
  IF is_google_oauth THEN
    -- Log the Google OAuth signup attempt
    INSERT INTO public.error_logs (
      error_type, error_message, context, user_id, metadata
    ) VALUES (
      'info',
      'Google OAuth signup detected',
      'handle_google_oauth_client_signup',
      NEW.id,
      jsonb_build_object(
        'email', NEW.email,
        'provider', NEW.app_metadata->>'provider',
        'full_name', NEW.user_metadata->>'full_name'
      )
    );
    
    -- Extract first and last name from full_name
    IF NEW.user_metadata->>'full_name' IS NOT NULL THEN
      user_name_parts := string_to_array(NEW.user_metadata->>'full_name', ' ');
      first_name := user_name_parts[1];
      last_name := array_to_string(user_name_parts[2:], ' ');
    END IF;
    
    -- Create client account
    SELECT public.create_client_account_for_user(
      NEW.id,
      'My Company', -- Default company name
      first_name,
      last_name
    ) INTO creation_result;
    
    -- Log the creation result
    INSERT INTO public.error_logs (
      error_type, error_message, context, user_id, metadata
    ) VALUES (
      'info',
      'Google OAuth client account creation result',
      'handle_google_oauth_client_signup',
      NEW.id,
      creation_result
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    INSERT INTO public.error_logs (
      error_type, error_message, error_stack, context, user_id, metadata
    ) VALUES (
      'google_oauth_client_creation_error',
      'Failed to create client account for Google OAuth user: ' || SQLERRM,
      SQLSTATE,
      'handle_google_oauth_client_signup',
      NEW.id,
      jsonb_build_object(
        'email', NEW.email,
        'provider', NEW.app_metadata->>'provider',
        'error_detail', SQLERRM
      )
    );
    
    RETURN NEW;
END;
$$;

-- Create the trigger for Google OAuth client account creation
DROP TRIGGER IF EXISTS on_google_oauth_client_signup ON auth.users;
CREATE TRIGGER on_google_oauth_client_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_google_oauth_client_signup();

-- Add better RLS policies for account_types table
DROP POLICY IF EXISTS "Users can insert their own account type" ON public.account_types;
CREATE POLICY "Users can insert their own account type" 
  ON public.account_types 
  FOR INSERT 
  WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own account type" ON public.account_types;
CREATE POLICY "Users can update their own account type" 
  ON public.account_types 
  FOR UPDATE 
  USING (auth_user_id = auth.uid());

-- Add cleanup function for old error logs to prevent table bloat
CREATE OR REPLACE FUNCTION public.cleanup_old_google_oauth_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.error_logs 
  WHERE created_at < NOW() - INTERVAL '7 days'
    AND context IN ('handle_google_oauth_client_signup', 'create_client_account_for_user')
    AND error_type = 'info';
END;
$$;
