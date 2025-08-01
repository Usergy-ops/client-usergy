-- Step 1: Drop all existing, conflicting triggers on the auth.users table
DROP TRIGGER IF EXISTS on_auth_user_client_created ON auth.users;
DROP TRIGGER IF EXISTS on_client_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_client ON auth.users;
DROP TRIGGER IF EXISTS on_google_oauth_client_signup ON auth.users;
DROP TRIGGER IF EXISTS on_google_oauth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_user_created_create_client_account ON auth.users;
DROP TRIGGER IF EXISTS on_user_created ON auth.users;

-- Step 2: Drop all old, conflicting functions
DROP FUNCTION IF EXISTS public.handle_new_client_user();
DROP FUNCTION IF EXISTS public.handle_client_account_creation();
DROP FUNCTION IF EXISTS public.handle_google_oauth_client_signup();
DROP FUNCTION IF EXISTS public.handle_new_user_client_account_creation();
DROP FUNCTION IF EXISTS public.create_client_account_for_user(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.ensure_client_account(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.ensure_client_account_robust(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.create_client_account(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.get_client_account_status(uuid);

-- Step 3: Add the missing columns to the client_workspace.company_profiles table
ALTER TABLE client_workspace.company_profiles
ADD COLUMN IF NOT EXISTS company_website TEXT,
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS company_size TEXT,
ADD COLUMN IF NOT EXISTS contact_role TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT,
ADD COLUMN IF NOT EXISTS company_country TEXT,
ADD COLUMN IF NOT EXISTS company_city TEXT,
ADD COLUMN IF NOT EXISTS company_timezone TEXT,
ADD COLUMN IF NOT EXISTS company_logo_url TEXT;

-- Step 4: Create the get_client_account_status RPC function
CREATE OR REPLACE FUNCTION public.get_client_account_status(user_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'client_workspace', 'auth'
AS $$
DECLARE
  result jsonb;
  user_record record;
  account_type_record record;
  profile_record record;
  company_profile_record record;
BEGIN
  -- Initialize result
  result := jsonb_build_object(
    'user_exists', false,
    'user_email', 'N/A',
    'user_provider', 'N/A',
    'account_type_exists', false,
    'account_type', 'N/A',
    'profile_exists', false,
    'company_profile_exists', false,
    'is_client_account', false,
    'errors', jsonb_build_object()
  );

  -- Get user info
  SELECT * INTO user_record FROM auth.users WHERE id = user_id_param;

  IF user_record.id IS NOT NULL THEN
    result := jsonb_set(result, '{user_exists}', 'true'::jsonb);
    result := jsonb_set(result, '{user_email}', to_jsonb(user_record.email));
    result := jsonb_set(result, '{user_provider}', to_jsonb(COALESCE(user_record.raw_app_meta_data->>'provider', 'email')));
  END IF;

  -- Get account type info
  SELECT * INTO account_type_record FROM public.account_types
  WHERE auth_user_id = user_id_param;

  IF account_type_record.auth_user_id IS NOT NULL THEN
    result := jsonb_set(result, '{account_type_exists}', 'true'::jsonb);
    result := jsonb_set(result, '{account_type}', to_jsonb(account_type_record.account_type));

    -- Check if is client account
    IF account_type_record.account_type = 'client' THEN
      result := jsonb_set(result, '{is_client_account}', 'true'::jsonb);
    END IF;
  END IF;

  -- Get company profile info if client_workspace schema exists
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'client_workspace') THEN
    EXECUTE 'SELECT * FROM client_workspace.company_profiles WHERE auth_user_id = $1'
    INTO company_profile_record
    USING user_id_param;

    IF company_profile_record.auth_user_id IS NOT NULL THEN
      result := jsonb_set(result, '{company_profile_exists}', 'true'::jsonb);
    END IF;
  END IF;

  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    -- Return error information
    RETURN jsonb_build_object(
      'user_exists', false,
      'error', SQLERRM,
      'sql_state', SQLSTATE
    );
END;
$$;

-- Step 5: Create the ensure_client_account_robust RPC function
CREATE OR REPLACE FUNCTION public.ensure_client_account_robust(
  user_id_param uuid,
  company_name_param text DEFAULT 'My Company',
  first_name_param text DEFAULT '',
  last_name_param text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'client_workspace', 'auth'
AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = user_id_param;

  IF user_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found',
      'user_id', user_id_param::text
    );
  END IF;

  -- Use a transaction block to ensure atomicity
  BEGIN
    -- Create or update account type
    INSERT INTO public.account_types (auth_user_id, account_type)
    VALUES (user_id_param, 'client')
    ON CONFLICT (auth_user_id) DO UPDATE SET
      account_type = 'client',
      created_at = COALESCE(account_types.created_at, NOW());

    -- Create or update company profile
    INSERT INTO client_workspace.company_profiles (
      auth_user_id,
      company_name,
      contact_first_name,
      contact_last_name,
      billing_email
    )
    VALUES (
      user_id_param,
      company_name_param,
      first_name_param,
      last_name_param,
      user_email
    )
    ON CONFLICT (auth_user_id) DO NOTHING;

  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Transaction failed: ' || SQLERRM,
        'step', 'transaction_block'
      );
  END;

  -- Final verification
  IF public.is_client_account(user_id_param) THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Client account ensured successfully'
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Client account verification failed after transaction'
    );
  END IF;
END;
$$;

-- Step 6: Create a single, authoritative trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  company_name text;
  first_name text;
  last_name text;
BEGIN
  -- Only process if this is a client account creation
  IF NEW.raw_user_meta_data->>'account_type' = 'client' THEN
    company_name := NEW.raw_user_meta_data->>'companyName';
    first_name := NEW.raw_user_meta_data->>'contactFirstName';
    last_name := NEW.raw_user_meta_data->>'contactLastName';

    PERFORM public.ensure_client_account_robust(
      NEW.id,
      company_name,
      first_name,
      last_name
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Create a single, authoritative trigger on the auth.users table
CREATE TRIGGER on_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
