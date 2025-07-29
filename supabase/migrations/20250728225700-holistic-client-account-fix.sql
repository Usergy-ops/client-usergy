-- Step 1: Drop all existing, conflicting triggers on the auth.users table
DROP TRIGGER IF EXISTS on_auth_user_client_created ON auth.users;
DROP TRIGGER IF EXISTS on_client_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_client ON auth.users;
DROP TRIGGER IF EXISTS on_google_oauth_client_signup ON auth.users;
DROP TRIGGER IF EXISTS on_google_oauth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_user_created_create_client_account ON auth.users;

-- Step 2: Drop all old, conflicting functions
DROP FUNCTION IF EXISTS public.handle_new_client_user();
DROP FUNCTION IF EXISTS public.handle_client_account_creation();
DROP FUNCTION IF EXISTS public.handle_google_oauth_client_signup();
DROP FUNCTION IF EXISTS public.handle_new_user_client_account_creation();
DROP FUNCTION IF EXISTS public.create_client_account_for_user(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.ensure_client_account(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.ensure_client_account_robust(uuid, text, text, text);

-- Step 3: Drop the redundant client schema and profiles table
DROP SCHEMA IF EXISTS client CASCADE;
DROP TABLE IF EXISTS public.profiles;

-- Step 4: Create a single, authoritative function to handle new client account creation
CREATE OR REPLACE FUNCTION public.create_client_account(
  user_id_param uuid,
  company_name_param text,
  first_name_param text,
  last_name_param text,
  email_param text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'client_workspace';
AS $$
BEGIN
  -- Create account_types record. Use ON CONFLICT to prevent race conditions.
  INSERT INTO public.account_types (auth_user_id, account_type)
  VALUES (user_id_param, 'client')
  ON CONFLICT (auth_user_id) DO NOTHING;

  -- Create company profile. Use ON CONFLICT to prevent race conditions.
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
    email_param
  )
  ON CONFLICT (auth_user_id) DO NOTHING;
END;
$$;

-- Step 5: Create a single, authoritative trigger function
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

    PERFORM public.create_client_account(
      NEW.id,
      company_name,
      first_name,
      last_name,
      NEW.email
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create a single, authoritative trigger on the auth.users table
CREATE TRIGGER on_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
