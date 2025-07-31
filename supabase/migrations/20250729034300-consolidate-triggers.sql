-- Step 1: Drop all existing, conflicting triggers on the auth.users table
DROP TRIGGER IF EXISTS on_auth_user_client_created ON auth.users;
DROP TRIGGER IF EXISTS on_client_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_client ON auth.users;
DROP TRIGGER IF EXISTS on_google_oauth_client_signup ON auth.users;
DROP TRIGGER IF EXISTS on_google_oauth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_user_created_create_client_account ON auth.users;
DROP TRIGGER IF EXISTS on_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_handle_client ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_unified ON auth.users;
DROP TRIGGER IF EXISTS on_client_account_creation ON auth.users;

-- Step 2: Drop all old, conflicting functions
DROP FUNCTION IF EXISTS public.handle_new_client_user();
DROP FUNCTION IF EXISTS public.handle_client_account_creation();
DROP FUNCTION IF EXISTS public.handle_google_oauth_client_signup();
DROP FUNCTION IF EXISTS public.handle_new_user_client_account_creation();
DROP FUNCTION IF EXISTS public.handle_new_user();

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
