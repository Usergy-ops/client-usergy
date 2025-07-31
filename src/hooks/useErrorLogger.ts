
import { supabase } from '@/integrations/supabase/client';

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

  const logAuthError = async (error: unknown, errorType: string, context?: string) => {
    try {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      await supabase
        .from('error_logs')
        .insert({
          error_type: errorType,
          error_message: errorMessage,
          error_stack: errorStack,
          context: context || 'authentication',
          metadata: {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
          }
        });
    } catch (logError) {
      console.error('Failed to log auth error:', logError);
    }
  };

  return { 
    logOTPError,
    logAuthError
  };
}
