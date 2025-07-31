-- Step 1: Drop all existing, incorrect functions
DROP FUNCTION IF EXISTS public.ensure_client_account_robust(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.create_client_account(uuid, text, text, text, text);

-- Step 2: Create a single, authoritative function to handle new client account creation with correct ON CONFLICT clauses
CREATE OR REPLACE FUNCTION public.create_client_account(
  user_id_param uuid,
  company_name_param text,
  first_name_param text,
  last_name_param text,
  email_param text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'client_workspace';
AS $$
BEGIN
  -- Create account_types record. The unique constraint is on (auth_user_id).
  INSERT INTO public.account_types (auth_user_id, account_type)
  VALUES (user_id_param, 'client')
  ON CONFLICT (auth_user_id) DO NOTHING;

  -- Create company profile. The unique constraint is on (auth_user_id).
  INSERT INTO client_workspace.company_profiles (
    auth_user_id,
    company_name,
    contact_first_name,
    contact_last_name,
    billing_email
  )
  VALUES (
    user_id_param,
    company_name_param,
    first_name_param,
    last_name_param,
    email_param
  )
  ON CONFLICT (auth_user_id) DO NOTHING;
END;
$$;

-- Step 3: Recreate the ensure_client_account_robust function with the correct ON CONFLICT clauses
CREATE OR REPLACE FUNCTION public.ensure_client_account_robust(
  user_id_param uuid,
  company_name_param text DEFAULT 'My Company',
  first_name_param text DEFAULT '',
  last_name_param text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'client_workspace', 'auth'
AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = user_id_param;

  IF user_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found',
      'user_id', user_id_param::text
    );
  END IF;

  -- Use a transaction block to ensure atomicity
  BEGIN
    -- Create or update account type
    INSERT INTO public.account_types (auth_user_id, account_type)
    VALUES (user_id_param, 'client')
    ON CONFLICT (auth_user_id) DO UPDATE SET
      account_type = 'client',
      created_at = COALESCE(account_types.created_at, NOW());

    -- Create or update company profile
    INSERT INTO client_workspace.company_profiles (
      auth_user_id,
      company_name,
      contact_first_name,
      contact_last_name,
      billing_email
    )
    VALUES (
      user_id_param,
      company_name_param,
      first_name_param,
      last_name_param,
      user_email
    )
    ON CONFLICT (auth_user_id) DO UPDATE SET
      company_name = EXCLUDED.company_name,
      contact_first_name = EXCLUDED.contact_first_name,
      contact_last_name = EXCLUDED.contact_last_name,
      billing_email = EXCLUDED.billing_email,
      updated_at = NOW();

  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Transaction failed: ' || SQLERRM,
        'step', 'transaction_block'
      );
  END;

  -- Final verification
  IF public.is_client_account(user_id_param) THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Client account ensured successfully'
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Client account verification failed after transaction'
    );
  END IF;
END;
$$;
