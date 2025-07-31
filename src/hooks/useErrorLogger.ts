
import { supabase } from '@/lib/supabase';

export function useErrorLogger() {
  const logOTPError = async (error: unknown, errorType: string, email?: string) => {
    try {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await supabase
        .from('error_logs')
        .insert({
          error_type: errorType,
          error_message: errorMessage,
          context: 'otp_verification',
          metadata: {
            email,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
          }
        });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  };

  return { logOTPError };
}
