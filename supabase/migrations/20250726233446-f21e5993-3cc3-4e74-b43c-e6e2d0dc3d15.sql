-- Create function to check if email exists for specific account type
CREATE OR REPLACE FUNCTION public.check_email_exists_for_account_type(
  email_param TEXT,
  account_type_param TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  exists_flag BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM auth.users u
    JOIN public.account_types at ON u.id = at.auth_user_id
    WHERE u.email = email_param 
    AND at.account_type = account_type_param
  ) INTO exists_flag;
  
  RETURN exists_flag;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the client signup trigger to handle metadata properly
CREATE OR REPLACE FUNCTION client_workspace.handle_new_client()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if marked as client signup (handle both possible metadata keys)
  IF NEW.raw_user_meta_data->>'accountType' = 'client' OR NEW.raw_user_meta_data->>'account_type' = 'client' THEN
    -- Add account type
    INSERT INTO public.account_types (auth_user_id, account_type)
    VALUES (NEW.id, 'client')
    ON CONFLICT (auth_user_id, account_type) DO NOTHING;
    
    -- Create client profile
    INSERT INTO client_workspace.company_profiles (
      auth_user_id, 
      contact_first_name,
      contact_last_name,
      company_name,
      industry,
      contact_role,
      company_country,
      company_timezone
    )
    VALUES (
      NEW.id, 
      COALESCE(NEW.raw_user_meta_data->>'contactFirstName', NEW.raw_user_meta_data->>'contact_first_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'contactLastName', NEW.raw_user_meta_data->>'contact_last_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'companyName', NEW.raw_user_meta_data->>'company_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'industry', 'Technology'),
      COALESCE(NEW.raw_user_meta_data->>'contact_role', 'Manager'),
      COALESCE(NEW.raw_user_meta_data->>'company_country', 'United States'),
      COALESCE(NEW.raw_user_meta_data->>'company_timezone', 'America/New_York')
    )
    ON CONFLICT (auth_user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_client_created ON auth.users;
CREATE TRIGGER on_auth_user_client_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION client_workspace.handle_new_client();