-- Step 1: Drop the existing, incorrect trigger and function
DROP TRIGGER IF EXISTS on_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.create_client_account(uuid, text, text, text, text);

-- Step 2: Create a single, authoritative function to handle new client account creation with correct ON CONFLICT clauses
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
  -- Create account_types record. Use ON CONFLICT (auth_user_id) to prevent race conditions.
  INSERT INTO public.account_types (auth_user_id, account_type)
  VALUES (user_id_param, 'client')
  ON CONFLICT (auth_user_id) DO NOTHING;

  -- Create company profile. Use ON CONFLICT (auth_user_id) to prevent race conditions.
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

-- Step 3: Create a single, authoritative trigger function
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

-- Step 4: Create a single, authoritative trigger on the auth.users table
CREATE TRIGGER on_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
