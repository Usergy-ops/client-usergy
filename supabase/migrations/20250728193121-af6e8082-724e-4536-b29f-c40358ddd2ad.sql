
-- Update the ensure_client_account function to set onboarding_status to 'complete'
CREATE OR REPLACE FUNCTION public.ensure_client_account(
  user_id_param uuid, 
  company_name_param text DEFAULT 'My Company'::text, 
  first_name_param text DEFAULT ''::text, 
  last_name_param text DEFAULT ''::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace', 'auth'
AS $function$
DECLARE
  user_email TEXT;
  existing_account BOOLEAN;
  result jsonb;
BEGIN
  -- Check if already a client
  existing_account := public.is_client_account(user_id_param);
  
  IF existing_account THEN
    -- Update existing profile to complete onboarding
    UPDATE client_workspace.company_profiles 
    SET onboarding_status = 'complete',
        updated_at = NOW()
    WHERE auth_user_id = user_id_param;
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Client account already exists - onboarding completed',
      'is_client', true
    );
  END IF;
  
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = user_id_param;
  
  IF user_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found',
      'is_client', false
    );
  END IF;
  
  -- Start transaction-like behavior
  BEGIN
    -- Create account type
    INSERT INTO public.account_types (auth_user_id, account_type)
    VALUES (user_id_param, 'client')
    ON CONFLICT (auth_user_id) DO UPDATE 
    SET account_type = 'client';
    
    -- Create company profile with complete onboarding status
    INSERT INTO client_workspace.company_profiles (
      auth_user_id,
      company_name,
      contact_first_name,
      contact_last_name,
      billing_email,
      contact_email,
      onboarding_status
    ) VALUES (
      user_id_param,
      company_name_param,
      first_name_param,
      last_name_param,
      user_email,
      user_email,
      'complete'
    ) ON CONFLICT (auth_user_id) DO UPDATE SET
      company_name = CASE 
        WHEN company_profiles.company_name = 'My Company' AND EXCLUDED.company_name != 'My Company'
        THEN EXCLUDED.company_name
        ELSE company_profiles.company_name
      END,
      contact_first_name = CASE
        WHEN company_profiles.contact_first_name = '' AND EXCLUDED.contact_first_name != ''
        THEN EXCLUDED.contact_first_name
        ELSE company_profiles.contact_first_name
      END,
      contact_last_name = CASE
        WHEN company_profiles.contact_last_name = '' AND EXCLUDED.contact_last_name != ''
        THEN EXCLUDED.contact_last_name
        ELSE company_profiles.contact_last_name
      END,
      onboarding_status = 'complete',
      updated_at = NOW();
    
    -- Verify creation was successful
    IF public.is_client_account(user_id_param) THEN
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Client account created successfully with complete onboarding',
        'is_client', true
      );
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Failed to create client account',
        'is_client', false
      );
    END IF;
    
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'is_client', false
      );
  END;
END;
$function$
