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
  result jsonb;
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

    -- Create or update profile
    INSERT INTO public.profiles (user_id, email, full_name, company)
    VALUES (
      user_id_param,
      user_email,
      TRIM(first_name_param || ' ' || last_name_param),
      company_name_param
    )
    ON CONFLICT (user_id) DO UPDATE SET
      full_name = CASE
        WHEN EXCLUDED.full_name IS NOT NULL AND EXCLUDED.full_name != ''
        THEN EXCLUDED.full_name
        ELSE profiles.full_name
      END,
      company = CASE
        WHEN EXCLUDED.company IS NOT NULL AND EXCLUDED.company != ''
        THEN EXCLUDED.company
        ELSE profiles.company
      END,
      updated_at = NOW();

    -- Create or update company profile if client_workspace schema exists
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'client_workspace') THEN
      EXECUTE 'INSERT INTO client_workspace.company_profiles (
        auth_user_id,
        company_name,
        contact_first_name,
        contact_last_name,
        billing_email,
        contact_email,
        onboarding_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (auth_user_id) DO UPDATE SET
        company_name = CASE
          WHEN EXCLUDED.company_name IS NOT NULL AND EXCLUDED.company_name != ''''
          THEN EXCLUDED.company_name
          ELSE company_profiles.company_name
        END,
        contact_first_name = CASE
          WHEN EXCLUDED.contact_first_name IS NOT NULL AND EXCLUDED.contact_first_name != ''''
          THEN EXCLUDED.contact_first_name
          ELSE company_profiles.contact_first_name
        END,
        contact_last_name = CASE
          WHEN EXCLUDED.contact_last_name IS NOT NULL AND EXCLUDED.contact_last_name != ''''
          THEN EXCLUDED.contact_last_name
          ELSE company_profiles.contact_last_name
        END,
        onboarding_status = ''complete'',
        updated_at = NOW()'
      USING user_id_param, company_name_param, first_name_param, last_name_param, user_email, user_email, 'complete';
    END IF;

  EXCEPTION
    WHEN OTHERS THEN
      PERFORM public.log_db_error('ensure_client_account_robust-transaction', SQLERRM, jsonb_build_object('user_id', user_id_param));
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
    PERFORM public.log_db_error('ensure_client_account_robust-verification', 'Verification failed after transaction', jsonb_build_object('user_id', user_id_param));
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Client account verification failed after transaction'
    );
  END IF;
END;
$$;
