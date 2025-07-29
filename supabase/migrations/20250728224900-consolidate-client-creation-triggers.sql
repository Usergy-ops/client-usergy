-- Step 1: Drop all existing, conflicting triggers on the auth.users table
DROP TRIGGER IF EXISTS on_auth_user_client_created ON auth.users;
DROP TRIGGER IF EXISTS on_client_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_client ON auth.users;
DROP TRIGGER IF EXISTS on_google_oauth_client_signup ON auth.users;
DROP TRIGGER IF EXISTS on_google_oauth_user_created ON auth.users;

-- Step 2: Create a single, authoritative function to handle new client account creation
CREATE OR REPLACE FUNCTION public.handle_new_user_client_account_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if this is a client account creation
  IF NEW.raw_user_meta_data->>'account_type' = 'client' THEN

    -- Create account_types record. Use ON CONFLICT to prevent race conditions.
    INSERT INTO public.account_types (auth_user_id, account_type)
    VALUES (NEW.id, 'client')
    ON CONFLICT (auth_user_id) DO NOTHING;

    -- Create company profile. Use ON CONFLICT to prevent race conditions.
    INSERT INTO client_workspace.company_profiles (
      auth_user_id,
      company_name,
      contact_first_name,
      contact_last_name,
      billing_email,
      onboarding_status
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'companyName', ''),
      COALESCE(NEW.raw_user_meta_data->>'contactFirstName', ''),
      COALESCE(NEW.raw_user_meta_data->>'contactLastName', ''),
      NEW.email,
      'incomplete'
    )
    ON CONFLICT (auth_user_id) DO NOTHING;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create a single, authoritative trigger on the auth.users table
CREATE TRIGGER on_user_created_create_client_account
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_client_account_creation();
