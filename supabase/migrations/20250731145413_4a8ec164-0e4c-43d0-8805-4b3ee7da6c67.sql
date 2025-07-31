
-- Create the is_profile_complete function in the public schema
CREATE OR REPLACE FUNCTION public.is_profile_complete(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  client_record record;
  required_fields text[] := ARRAY['email', 'company_name'];
  field_name text;
BEGIN
  -- Check if client record exists in client_workflow.clients
  SELECT * INTO client_record 
  FROM client_workflow.clients 
  WHERE auth_user_id = user_id_param;
  
  -- If no client record exists, profile is incomplete
  IF client_record.auth_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check each required field
  FOREACH field_name IN ARRAY required_fields
  LOOP
    -- Use CASE to check different fields
    CASE field_name
      WHEN 'email' THEN
        IF client_record.email IS NULL OR client_record.email = '' THEN
          RETURN false;
        END IF;
      WHEN 'company_name' THEN
        IF client_record.company_name IS NULL OR client_record.company_name = '' THEN
          RETURN false;
        END IF;
    END CASE;
  END LOOP;
  
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
