
-- 1. Create the missing is_profile_complete function
CREATE OR REPLACE FUNCTION public.is_profile_complete(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user has a complete company profile
  RETURN EXISTS (
    SELECT 1 
    FROM client_workspace.company_profiles 
    WHERE auth_user_id = user_id_param 
      AND company_name IS NOT NULL 
      AND industry IS NOT NULL 
      AND company_size IS NOT NULL 
      AND contact_role IS NOT NULL 
      AND company_country IS NOT NULL 
      AND company_city IS NOT NULL 
      AND company_timezone IS NOT NULL
      AND onboarding_status = 'completed'
  );
END;
$$;

-- 2. Add RLS policies for client_workflow.clients table
ALTER TABLE client_workflow.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own client profile"
  ON client_workflow.clients
  FOR SELECT
  USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert their own client profile"
  ON client_workflow.clients
  FOR INSERT
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own client profile"
  ON client_workflow.clients
  FOR UPDATE
  USING (auth_user_id = auth.uid());

CREATE POLICY "Service role can manage all client profiles"
  ON client_workflow.clients
  FOR ALL
  USING (auth.role() = 'service_role');

-- 3. Add RLS policies for client_workspace.company_profiles table
ALTER TABLE client_workspace.company_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own company profile"
  ON client_workspace.company_profiles
  FOR SELECT
  USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert their own company profile"
  ON client_workspace.company_profiles
  FOR INSERT
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own company profile"
  ON client_workspace.company_profiles
  FOR UPDATE
  USING (auth_user_id = auth.uid());

CREATE POLICY "Service role can manage all company profiles"
  ON client_workspace.company_profiles
  FOR ALL
  USING (auth.role() = 'service_role');
