
-- Add email confirmation and password reset functionality for client accounts
CREATE TABLE IF NOT EXISTS public.client_password_resets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT
);

-- Add email confirmation tracking for clients
CREATE TABLE IF NOT EXISTS public.client_email_confirmations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT
);

-- RLS policies for client password resets
ALTER TABLE public.client_password_resets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own password reset requests" 
  ON public.client_password_resets 
  FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage password resets" 
  ON public.client_password_resets 
  FOR ALL 
  USING (auth.role() = 'service_role');

-- RLS policies for client email confirmations
ALTER TABLE public.client_email_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email confirmations" 
  ON public.client_email_confirmations 
  FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage email confirmations" 
  ON public.client_email_confirmations 
  FOR ALL 
  USING (auth.role() = 'service_role');

-- Add function for client password reset token generation
CREATE OR REPLACE FUNCTION public.generate_client_password_reset_token(user_email text)
RETURNS TABLE(token text, expires_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Add function for client email confirmation
CREATE OR REPLACE FUNCTION public.generate_client_email_confirmation_token(user_id_param uuid)
RETURNS TABLE(token text, expires_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Add enhanced rate limiting for client auth operations
INSERT INTO enhanced_rate_limits (identifier, action, window_start, window_end, attempts, blocked_until)
VALUES 
  ('client_signin_rate_limit', 'client_signin', now(), now() + interval '1 hour', 0, NULL),
  ('client_password_reset_rate_limit', 'client_password_reset', now(), now() + interval '1 hour', 0, NULL)
ON CONFLICT DO NOTHING;
