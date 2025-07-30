
-- Phase 3: RLS Policy Implementation
-- Enable RLS on all client-related tables and create comprehensive policies

-- 1. Enable RLS on account_types table (if not already enabled)
ALTER TABLE public.account_types ENABLE ROW LEVEL SECURITY;

-- 2. Create policies for account_types table
-- Since account_types is a lookup table, we'll allow read access to authenticated users
CREATE POLICY "Authenticated users can read account types" 
  ON public.account_types 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- 3. Enable RLS on company_profiles table (if not already enabled) 
ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;

-- 4. Update company_profiles policies (drop existing and recreate for consistency)
DROP POLICY IF EXISTS "Users can view their own company profile" ON public.company_profiles;
DROP POLICY IF EXISTS "Users can create their own company profile" ON public.company_profiles;
DROP POLICY IF EXISTS "Users can update their own company profile" ON public.company_profiles;
DROP POLICY IF EXISTS "Users can delete their own company profile" ON public.company_profiles;

-- Create comprehensive company_profiles policies
CREATE POLICY "Users can view their own company profile" 
  ON public.company_profiles 
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own company profile" 
  ON public.company_profiles 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own company profile" 
  ON public.company_profiles 
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own company profile" 
  ON public.company_profiles 
  FOR DELETE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- 5. Enable RLS on user_account_types table
ALTER TABLE public.user_account_types ENABLE ROW LEVEL SECURITY;

-- 6. Create policies for user_account_types table
CREATE POLICY "Users can view their own account type" 
  ON public.user_account_types 
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage user account types" 
  ON public.user_account_types 
  FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- 7. Enable RLS on error_logs table (if it exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'error_logs' AND table_schema = 'public') THEN
        ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
        
        -- Create policy for error_logs - users can only see their own errors
        CREATE POLICY "Users can view their own error logs" 
          ON public.error_logs 
          FOR SELECT 
          TO authenticated 
          USING (user_id = auth.uid() OR user_id IS NULL);
          
        -- Allow users to insert their own error logs
        CREATE POLICY "Users can create error logs" 
          ON public.error_logs 
          FOR INSERT 
          TO authenticated 
          WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
    END IF;
END $$;

-- 8. Create a function to test RLS policies
CREATE OR REPLACE FUNCTION test_rls_policies_for_user(test_user_id UUID)
RETURNS TABLE(
    table_name TEXT,
    operation TEXT,
    can_access BOOLEAN,
    error_message TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Test account_types SELECT
    BEGIN
        PERFORM * FROM public.account_types LIMIT 1;
        RETURN QUERY SELECT 'account_types'::TEXT, 'SELECT'::TEXT, true, NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 'account_types'::TEXT, 'SELECT'::TEXT, false, SQLERRM;
    END;
    
    -- Test company_profiles operations for the test user
    BEGIN
        PERFORM * FROM public.company_profiles WHERE user_id = test_user_id;
        RETURN QUERY SELECT 'company_profiles'::TEXT, 'SELECT'::TEXT, true, NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 'company_profiles'::TEXT, 'SELECT'::TEXT, false, SQLERRM;
    END;
    
    -- Test user_account_types operations for the test user
    BEGIN
        PERFORM * FROM public.user_account_types WHERE user_id = test_user_id;
        RETURN QUERY SELECT 'user_account_types'::TEXT, 'SELECT'::TEXT, true, NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 'user_account_types'::TEXT, 'SELECT'::TEXT, false, SQLERRM;
    END;
    
    RETURN;
END;
$$;

-- 9. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.account_types TO authenticated;
GRANT ALL ON public.company_profiles TO authenticated;
GRANT ALL ON public.user_account_types TO authenticated;

-- Grant execute permissions on our functions
GRANT EXECUTE ON FUNCTION public.is_client_account(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_client_account_unified(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.diagnose_client_account_comprehensive(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_rls_policies_for_user(UUID) TO authenticated;
