
-- Fix the is_profile_complete function to check the correct table (client_workflow.clients instead of client_workspace.company_profiles)
CREATE OR REPLACE FUNCTION public.is_profile_complete(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'client_workflow'
AS $$
DECLARE
  client_record client_workflow.clients%ROWTYPE;
BEGIN
  -- Get the client record from the correct schema
  SELECT * INTO client_record
  FROM client_workflow.clients
  WHERE auth_user_id = user_id_param;
  
  -- If no client record exists, profile is not complete
  IF client_record.auth_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if all required fields are present and not empty
  IF client_record.email IS NOT NULL AND 
     client_record.email != '' AND
     client_record.company_name IS NOT NULL AND 
     client_record.company_name != '' THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Add RLS policies for client_workflow.otp_verifications table
ALTER TABLE client_workflow.otp_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role to manage OTP verifications"
ON client_workflow.otp_verifications
FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Allow anonymous users to verify OTP"
ON client_workflow.otp_verifications
FOR SELECT
USING (true);

-- Add RLS policies for client_workflow.clients table
ALTER TABLE client_workflow.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own client record"
ON client_workflow.clients
FOR SELECT
USING (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own client record"
ON client_workflow.clients
FOR UPDATE
USING (auth_user_id = auth.uid());

CREATE POLICY "Service role can manage all client records"
ON client_workflow.clients
FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can create client records"
ON client_workflow.clients
FOR INSERT
WITH CHECK (auth_user_id = auth.uid());
