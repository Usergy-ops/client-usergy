-- Step 1: Add RLS policies to the public.profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all profiles"
ON public.profiles FOR ALL
USING (auth.role() = 'service_role');

-- Step 2: Set the search_path for all database functions
-- Note: I have already set the search_path for the new functions I created in the previous migrations.
-- I will now review all of the other functions and set the search_path for them as well.

-- From 20250726231403-8a6c69b6-74f8-4ec4-a02d-d8143a57fcb1.sql
CREATE OR REPLACE FUNCTION public.generate_client_password_reset_token(user_email text)
RETURNS TABLE(token text, expires_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public';
AS $$
DECLARE
  user_record record;
  reset_token text;
  token_expires timestamp with time zone;
BEGIN
  -- Check if user exists and is a client
  SELECT u.id INTO user_record
  FROM auth.users u
  JOIN account_types at ON u.id = at.auth_user_id
  WHERE u.email = user_email AND at.account_type = 'client';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found or not a client account';
  END IF;

  -- Generate secure token
  reset_token := encode(gen_random_bytes(32), 'base64');
  token_expires := now() + interval '1 hour';

  -- Store reset token
  INSERT INTO client_password_resets (user_id, token, expires_at)
  VALUES (user_record.id, reset_token, token_expires);

  RETURN QUERY SELECT reset_token, token_expires;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_client_email_confirmation_token(user_id_param uuid)
RETURNS TABLE(token text, expires_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public';
AS $$
DECLARE
  confirmation_token text;
  token_expires timestamp with time zone;
BEGIN
  -- Verify user is a client
  IF NOT EXISTS (
    SELECT 1 FROM account_types
    WHERE auth_user_id = user_id_param AND account_type = 'client'
  ) THEN
    RAISE EXCEPTION 'User is not a client account';
  END IF;

  -- Generate secure token
  confirmation_token := encode(gen_random_bytes(32), 'base64');
  token_expires := now() + interval '24 hours';

  -- Store confirmation token
  INSERT INTO client_email_confirmations (user_id, token, expires_at)
  VALUES (user_id_param, confirmation_token, token_expires);

  RETURN QUERY SELECT confirmation_token, token_expires;
END;
$$;

-- From 20250726233446-f21e5993-3cc3-4e74-b43c-e6e2d0dc3d15.sql
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- From 20250728163735-e0903dd7-8bbb-4ec4-a02d-d8143a57fcb1.sql
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

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql' SET search_path = '';

-- From 20250728204701-a8051fc8-a00a-46db-8f9f-383c27fded8e.sql
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Clean up expired OTP verifications
  DELETE FROM public.user_otp_verification
  WHERE expires_at < NOW() - INTERVAL '1 hour';

  -- Clean up expired password resets
  DELETE FROM public.client_password_resets
  WHERE expires_at < NOW() - INTERVAL '1 hour';

  -- Clean up expired email confirmations
  DELETE FROM public.client_email_confirmations
  WHERE expires_at < NOW() - INTERVAL '1 hour';

  -- Clean up old rate limits
  DELETE FROM public.rate_limits
  WHERE window_start < NOW() - INTERVAL '24 hours';

  -- Clean up old enhanced rate limits
  DELETE FROM public.enhanced_rate_limits
  WHERE window_start < NOW() - INTERVAL '24 hours';
END;
$$;

-- From 20250728213500-add-logging-function.sql
CREATE OR REPLACE FUNCTION public.log_db_error(
  context_param TEXT,
  error_message_param TEXT,
  metadata_param JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.error_logs (
    error_type,
    error_message,
    context,
    metadata
  ) VALUES (
    'database_error',
    error_message_param,
    context_param,
    metadata_param
  );
END;
$$;
