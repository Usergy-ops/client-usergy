
-- First, let's add the missing columns to the client_workflow.clients table to support all profile data
ALTER TABLE client_workflow.clients 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS contact_role TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT,
ADD COLUMN IF NOT EXISTS company_website TEXT,
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS company_size TEXT,
ADD COLUMN IF NOT EXISTS company_country TEXT,
ADD COLUMN IF NOT EXISTS company_city TEXT,
ADD COLUMN IF NOT EXISTS company_timezone TEXT,
ADD COLUMN IF NOT EXISTS company_logo_url TEXT,
ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'pending';

-- Update the is_profile_complete function to check all required fields
CREATE OR REPLACE FUNCTION public.is_profile_complete(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  client_record record;
BEGIN
  -- Check if client record exists in client_workflow.clients
  SELECT * INTO client_record 
  FROM client_workflow.clients 
  WHERE auth_user_id = user_id_param;
  
  -- If no client record exists, profile is incomplete
  IF client_record.auth_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check all required fields for complete profile
  IF client_record.email IS NULL OR client_record.email = '' OR
     client_record.company_name IS NULL OR client_record.company_name = '' OR
     client_record.industry IS NULL OR client_record.industry = '' OR
     client_record.company_size IS NULL OR client_record.company_size = '' OR
     client_record.contact_role IS NULL OR client_record.contact_role = '' OR
     client_record.company_country IS NULL OR client_record.company_country = '' OR
     client_record.company_city IS NULL OR client_record.company_city = '' OR
     client_record.company_timezone IS NULL OR client_record.company_timezone = '' OR
     client_record.full_name IS NULL OR client_record.full_name = '' THEN
    RETURN false;
  END IF;
  
  -- If we get here, all required fields are present
  RETURN true;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return false for safety
    INSERT INTO public.error_logs (
      error_type,
      error_message,
      context,
      user_id,
      metadata
    ) VALUES (
      'profile_completion_check_error',
      SQLERRM,
      'is_profile_complete',
      user_id_param,
      jsonb_build_object(
        'error_detail', SQLERRM,
        'function', 'public.is_profile_complete'
      )
    );
    RETURN false;
END;
$$;

-- Create a comprehensive function to save complete profile data
CREATE OR REPLACE FUNCTION public.save_complete_client_profile(
  user_id_param uuid,
  company_name_param text,
  full_name_param text,
  company_website_param text DEFAULT NULL,
  industry_param text DEFAULT NULL,
  company_size_param text DEFAULT NULL,
  contact_role_param text DEFAULT NULL,
  contact_phone_param text DEFAULT NULL,
  company_country_param text DEFAULT NULL,
  company_city_param text DEFAULT NULL,
  company_timezone_param text DEFAULT NULL,
  company_logo_url_param text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email text;
  first_name_value text;
  last_name_value text;
  name_parts text[];
BEGIN
  -- Get user email from auth.users
  SELECT email INTO user_email FROM auth.users WHERE id = user_id_param;
  
  IF user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Parse full name into first and last name
  IF full_name_param IS NOT NULL AND trim(full_name_param) != '' THEN
    name_parts := string_to_array(trim(full_name_param), ' ');
    first_name_value := COALESCE(name_parts[1], '');
    last_name_value := COALESCE(array_to_string(name_parts[2:], ' '), '');
  ELSE
    first_name_value := '';
    last_name_value := '';
  END IF;
  
  -- Insert or update client record with all profile data
  INSERT INTO client_workflow.clients (
    auth_user_id,
    email,
    full_name,
    first_name,
    last_name,
    company_name,
    company_website,
    industry,
    company_size,
    contact_role,
    contact_phone,
    company_country,
    company_city,
    company_timezone,
    company_logo_url,
    onboarding_status
  ) VALUES (
    user_id_param,
    user_email,
    full_name_param,
    first_name_value,
    last_name_value,
    company_name_param,
    company_website_param,
    industry_param,
    company_size_param,
    contact_role_param,
    contact_phone_param,
    company_country_param,
    company_city_param,
    company_timezone_param,
    company_logo_url_param,
    'completed'
  )
  ON CONFLICT (auth_user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    company_name = EXCLUDED.company_name,
    company_website = EXCLUDED.company_website,
    industry = EXCLUDED.industry,
    company_size = EXCLUDED.company_size,
    contact_role = EXCLUDED.contact_role,
    contact_phone = EXCLUDED.contact_phone,
    company_country = EXCLUDED.company_country,
    company_city = EXCLUDED.company_city,
    company_timezone = EXCLUDED.company_timezone,
    company_logo_url = EXCLUDED.company_logo_url,
    onboarding_status = 'completed',
    updated_at = now();
    
  RETURN jsonb_build_object('success', true, 'message', 'Client profile saved successfully');
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
