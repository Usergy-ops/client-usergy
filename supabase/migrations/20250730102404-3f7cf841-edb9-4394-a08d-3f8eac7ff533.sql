
-- Create a trigger function that calls assign_account_type_by_domain for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_account_type_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  -- Only process confirmed users (email confirmed or OAuth)
  IF NEW.email_confirmed_at IS NOT NULL OR 
     NEW.raw_app_meta_data->>'provider' IN ('google', 'github') THEN
    
    -- Call the existing assign_account_type_by_domain function
    PERFORM public.assign_account_type_by_domain(NEW.id, NEW.email);
    
    -- Log the trigger execution
    INSERT INTO public.error_logs (
      error_type,
      error_message,
      context,
      user_id,
      metadata
    ) VALUES (
      'info',
      'Account type assignment trigger executed',
      'handle_new_user_account_type_assignment',
      NEW.id,
      jsonb_build_object(
        'email', NEW.email,
        'provider', NEW.raw_app_meta_data->>'provider'
      )
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but never block user creation
    INSERT INTO public.error_logs (
      error_type,
      error_message,
      context,
      user_id,
      metadata
    ) VALUES (
      'account_type_assignment_trigger_error',
      SQLERRM,
      'handle_new_user_account_type_assignment',
      NEW.id,
      jsonb_build_object(
        'email', NEW.email,
        'error_detail', SQLERRM
      )
    );
    
    RETURN NEW;
END;
$function$;

-- Create the trigger on auth.users table
CREATE TRIGGER trigger_new_user_account_type_assignment
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_account_type_assignment();
