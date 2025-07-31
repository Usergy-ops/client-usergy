
-- Complete cleanup of client-related database structures

-- 1. Drop all client-related tables from public schema
DROP TABLE IF EXISTS public.client_email_confirmations CASCADE;
DROP TABLE IF EXISTS public.client_password_resets CASCADE;
DROP TABLE IF EXISTS public.user_otp_verification CASCADE;

-- 2. Drop all client-related functions from public schema
DROP FUNCTION IF EXISTS public.create_client_account_for_user(uuid, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.is_client_account(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.force_create_client_account(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.create_client_account_safe(uuid, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.diagnose_user_account(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.handle_client_account_creation() CASCADE;
DROP FUNCTION IF EXISTS public.ensure_client_account(uuid, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.check_user_is_client(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_client_account_status(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.ensure_client_account_robust(uuid, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user_client_creation() CASCADE;
DROP FUNCTION IF EXISTS public.handle_google_oauth_client_signup() CASCADE;
DROP FUNCTION IF EXISTS public.generate_client_password_reset_token(text) CASCADE;
DROP FUNCTION IF EXISTS public.generate_client_email_confirmation_token(uuid) CASCADE;

-- 3. Drop all existing auth.users triggers that could conflict
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_client ON auth.users;
DROP TRIGGER IF EXISTS handle_client_account_creation_trigger ON auth.users;
DROP TRIGGER IF EXISTS on_google_oauth_client_signup ON auth.users;
DROP TRIGGER IF EXISTS handle_google_oauth_client_signup_trigger ON auth.users;
DROP TRIGGER IF EXISTS on_google_oauth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_account_type_assignment_trigger ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_unified_trigger ON auth.users;
DROP TRIGGER IF EXISTS handle_unified_user_signup_trigger ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_client_creation_trigger ON auth.users;

-- 4. Clean up existing client schemas
DROP SCHEMA IF EXISTS client_workspace CASCADE;
DROP SCHEMA IF EXISTS client CASCADE;

-- 5. Create clean client_workflow schema
CREATE SCHEMA client_workflow;

-- 6. Grant necessary permissions on the new schema
GRANT USAGE ON SCHEMA client_workflow TO authenticated;
GRANT USAGE ON SCHEMA client_workflow TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA client_workflow TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA client_workflow TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA client_workflow TO service_role;

-- 7. Set default privileges for future objects in client_workflow schema
ALTER DEFAULT PRIVILEGES IN SCHEMA client_workflow GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA client_workflow GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA client_workflow GRANT ALL ON FUNCTIONS TO service_role;

-- Log the cleanup completion
INSERT INTO public.error_logs (
  error_type,
  error_message,
  context,
  metadata
) VALUES (
  'info',
  'Complete client database cleanup completed successfully',
  'database_cleanup',
  jsonb_build_object(
    'cleanup_type', 'complete_client_cleanup',
    'schemas_dropped', ARRAY['client_workspace', 'client'],
    'schema_created', 'client_workflow',
    'timestamp', NOW()
  )
);
