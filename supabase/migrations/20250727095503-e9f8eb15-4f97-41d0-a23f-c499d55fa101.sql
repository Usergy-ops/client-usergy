-- Create trigger function to handle new client user creation
CREATE OR REPLACE FUNCTION public.handle_new_client_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  signup_data JSONB;
  company_name TEXT;
  first_name TEXT;
  last_name TEXT;
BEGIN
  -- Only process if this is a client signup (check for specific metadata)
  signup_data := NEW.raw_user_meta_data;
  
  IF signup_data ? 'account_type' AND signup_data->>'account_type' = 'client' THEN
    -- Extract client-specific data
    company_name := signup_data->>'company_name';
    first_name := signup_data->>'first_name';  
    last_name := signup_data->>'last_name';
    
    -- Create account_types record
    INSERT INTO public.account_types (auth_user_id, account_type)
    VALUES (NEW.id, 'client')
    ON CONFLICT (auth_user_id) DO NOTHING;
    
    -- Create company profile in client_workspace schema if it doesn't exist
    -- First ensure the schema exists
    CREATE SCHEMA IF NOT EXISTS client_workspace;
    
    -- Create company_profiles table if it doesn't exist
    CREATE TABLE IF NOT EXISTS client_workspace.company_profiles (
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
    
    -- Enable RLS on company_profiles
    ALTER TABLE client_workspace.company_profiles ENABLE ROW LEVEL SECURITY;
    
    -- Create RLS policy for company_profiles
    DROP POLICY IF EXISTS "Users can manage their own company profile" ON client_workspace.company_profiles;
    CREATE POLICY "Users can manage their own company profile"
    ON client_workspace.company_profiles
    FOR ALL
    USING (auth_user_id = auth.uid());
    
    -- Insert company profile
    INSERT INTO client_workspace.company_profiles (
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
    
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Failed to create client records for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$function$;

-- Create the trigger (only if it doesn't exist)
DROP TRIGGER IF EXISTS on_auth_user_created_client ON auth.users;
CREATE TRIGGER on_auth_user_created_client
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_client_user();