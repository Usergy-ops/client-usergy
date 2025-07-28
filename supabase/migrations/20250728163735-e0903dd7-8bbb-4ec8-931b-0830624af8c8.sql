
-- Create OTP verification table for client signup flow
CREATE TABLE IF NOT EXISTS public.user_otp_verification (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  attempts INTEGER DEFAULT 0,
  ip_address INET,
  user_agent TEXT,
  blocked_until TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_otp_verification_email ON public.user_otp_verification(email);
CREATE INDEX IF NOT EXISTS idx_user_otp_verification_otp_code ON public.user_otp_verification(otp_code);
CREATE INDEX IF NOT EXISTS idx_user_otp_verification_expires_at ON public.user_otp_verification(expires_at);

-- Enable RLS
ALTER TABLE public.user_otp_verification ENABLE ROW LEVEL SECURITY;

-- RLS policies for OTP verification
CREATE POLICY "Service role can manage OTP verifications" 
  ON public.user_otp_verification 
  FOR ALL 
  USING (auth.role() = 'service_role');

-- Create error_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  context TEXT,
  user_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for error_logs
CREATE INDEX IF NOT EXISTS idx_error_logs_error_type ON public.error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON public.error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON public.error_logs(created_at);

-- Enable RLS for error_logs
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for error_logs
CREATE POLICY "Service role can manage error logs" 
  ON public.error_logs 
  FOR ALL 
  USING (auth.role() = 'service_role');

CREATE POLICY "Allow error logging for authenticated and anonymous users" 
  ON public.error_logs 
  FOR INSERT 
  WITH CHECK (true);

-- Add function to clean up expired OTPs
CREATE OR REPLACE FUNCTION public.cleanup_expired_otp()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_otp_verification 
  WHERE expires_at < NOW() 
    AND (verified_at IS NULL OR verified_at < NOW() - INTERVAL '1 hour');
END;
$$;

-- Create a trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Ensure the Google OAuth trigger function exists and is correct
CREATE OR REPLACE FUNCTION public.handle_google_oauth_client_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'client_workspace', 'auth'
AS $function$
DECLARE
  full_name TEXT;
  name_parts TEXT[];
  first_name TEXT;
  last_name TEXT;
  profile_exists BOOLEAN;
BEGIN
  -- Only process Google OAuth users
  IF NEW.raw_app_meta_data->>'provider' = 'google' THEN
    
    -- Check if client profile already exists
    SELECT EXISTS(
      SELECT 1 FROM client_workspace.company_profiles 
      WHERE auth_user_id = NEW.id
    ) INTO profile_exists;
    
    -- Only create if profile doesn't exist
    IF NOT profile_exists THEN
      -- Create account type record first
      INSERT INTO public.account_types (auth_user_id, account_type)
      VALUES (NEW.id, 'client')
      ON CONFLICT (auth_user_id, account_type) DO UPDATE SET account_type = 'client';
      
      -- Extract name parts from Google metadata
      full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
      name_parts := string_to_array(full_name, ' ');
      first_name := COALESCE(name_parts[1], '');
      last_name := COALESCE(array_to_string(name_parts[2:], ' '), '');
      
      -- Create client workspace profile
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
        'My Company',
        first_name,
        last_name,
        NEW.email,
        'incomplete'
      );
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create client profile for Google OAuth user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$function$;

-- Drop and recreate the Google OAuth trigger to ensure it's active
DROP TRIGGER IF EXISTS on_google_oauth_client_signup ON auth.users;
DROP TRIGGER IF EXISTS on_google_oauth_user_created ON auth.users;

CREATE TRIGGER on_google_oauth_client_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_google_oauth_client_signup();
