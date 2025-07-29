
-- Create the missing RPC function for client account status
CREATE OR REPLACE FUNCTION public.get_client_account_status(user_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace', 'auth'
AS $$
DECLARE
  user_record record;
  account_type_record record;
  profile_record record;
  result jsonb;
BEGIN
  -- Get user info from auth.users
  SELECT * INTO user_record FROM auth.users WHERE id = user_id_param;
  
  -- Get account type info
  SELECT * INTO account_type_record FROM public.account_types 
  WHERE auth_user_id = user_id_param;
  
  -- Get profile info from client_workspace
  SELECT * INTO profile_record FROM client_workspace.company_profiles 
  WHERE auth_user_id = user_id_param;
  
  -- Build comprehensive result
  result := jsonb_build_object(
    'user_exists', user_record.id IS NOT NULL,
    'user_email', user_record.email,
    'user_provider', user_record.raw_app_meta_data->>'provider',
    'account_type_exists', account_type_record.auth_user_id IS NOT NULL,
    'account_type', account_type_record.account_type,
    'profile_exists', profile_record.auth_user_id IS NOT NULL,
    'company_profile_exists', profile_record.auth_user_id IS NOT NULL,
    'is_client_account', public.is_client_account(user_id_param),
    'errors', ARRAY[]::text[]
  );
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    -- Return error information
    RETURN jsonb_build_object(
      'user_exists', false,
      'user_email', null,
      'user_provider', null,
      'account_type_exists', false,
      'account_type', null,
      'profile_exists', false,
      'company_profile_exists', false,
      'is_client_account', false,
      'errors', ARRAY[SQLERRM]
    );
END;
$$;

-- Create the robust client account creation function
CREATE OR REPLACE FUNCTION public.ensure_client_account_robust(
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
  user_email text;
  result jsonb;
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = user_id_param;
  
  IF user_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found',
      'is_client_account', false
    );
  END IF;
  
  -- Create account type record
  INSERT INTO public.account_types (auth_user_id, account_type)
  VALUES (user_id_param, 'client')
  ON CONFLICT (auth_user_id, account_type) DO UPDATE SET
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
    user_id_param,
    company_name_param,
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
    updated_at = NOW();
  
  -- Verify creation was successful
  IF public.is_client_account(user_id_param) THEN
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
      'ensure_client_account_robust',
      user_id_param,
      jsonb_build_object(
        'company_name', company_name_param,
        'first_name', first_name_param,
        'last_name', last_name_param,
        'email', user_email
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'is_client_account', false
    );
END;
$$;

-- Add missing RLS policies for client_workspace.company_profiles
ALTER TABLE client_workspace.company_profiles ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own company profiles
CREATE POLICY "Users can view their own company profiles"
ON client_workspace.company_profiles
FOR SELECT
USING (auth_user_id = auth.uid());

-- Policy for users to insert their own company profiles
CREATE POLICY "Users can insert their own company profiles"
ON client_workspace.company_profiles
FOR INSERT
WITH CHECK (auth_user_id = auth.uid());

-- Policy for users to update their own company profiles
CREATE POLICY "Users can update their own company profiles"
ON client_workspace.company_profiles
FOR UPDATE
USING (auth_user_id = auth.uid());

-- Policy for service role to manage all company profiles
CREATE POLICY "Service role can manage all company profiles"
ON client_workspace.company_profiles
FOR ALL
USING (auth.role() = 'service_role');

-- Create a trigger to automatically create client accounts for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_client_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace', 'auth'
AS $$
DECLARE
  full_name text;
  name_parts text[];
  first_name text := '';
  last_name text := '';
BEGIN
  -- Only process if this is a new user signup (not OAuth callback)
  IF NEW.email_confirmed_at IS NOT NULL OR NEW.raw_app_meta_data->>'provider' = 'google' THEN
    -- Extract name from metadata
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
    
    -- Create client account
    PERFORM public.ensure_client_account_robust(
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'companyName', 'My Company'),
      first_name,
      last_name
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    INSERT INTO public.error_logs (
      error_type,
      error_message,
      context,
      user_id,
      metadata
    ) VALUES (
      'client_account_creation_trigger_error',
      SQLERRM,
      'handle_new_user_client_creation',
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

-- Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created_client ON auth.users;
CREATE TRIGGER on_auth_user_created_client
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_client_creation();
