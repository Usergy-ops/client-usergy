-- Add a helper function for logging errors from within the database
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
