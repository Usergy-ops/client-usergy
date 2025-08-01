
import { supabase } from '@/integrations/supabase/client';

export function useEnhancedErrorLogger() {
  const logOTPError = async (
    error: any, 
    errorType: string, 
    email: string, 
    metadata?: any
  ) => {
    try {
      await supabase
        .from('error_logs')
        .insert({
          error_type: errorType,
          error_message: error?.message || 'Unknown error',
          context: 'otp_verification',
          metadata: {
            email,
            ...metadata
          }
        });
    } catch (logError) {
      console.error('Failed to log OTP error:', logError);
    }
  };

  return {
    logOTPError
  };
}
