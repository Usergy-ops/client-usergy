
import { supabase } from '@/lib/supabase';

export function useErrorLogger() {
  const logAuthError = async (error: any, context: string) => {
    try {
      const errorData = {
        error_type: 'auth_error',
        error_message: error?.message || 'Unknown error',
        error_stack: error?.stack || null,
        context,
        user_id: null,
        metadata: {
          timestamp: new Date().toISOString(),
          error_code: error?.code || null,
          error_details: error?.details || null,
          user_agent: navigator.userAgent,
          url: window.location.href
        }
      };

      await supabase.from('error_logs').insert(errorData);
    } catch (logError) {
      console.error('Failed to log auth error:', logError);
    }
  };

  const logOTPError = async (error: any, context: string, email?: string) => {
    try {
      const errorData = {
        error_type: 'otp_error',
        error_message: error?.message || 'Unknown OTP error',
        error_stack: error?.stack || null,
        context,
        user_id: null,
        metadata: {
          timestamp: new Date().toISOString(),
          error_code: error?.code || null,
          error_details: error?.details || null,
          user_agent: navigator.userAgent,
          url: window.location.href,
          email: email || null
        }
      };

      await supabase.from('error_logs').insert(errorData);
    } catch (logError) {
      console.error('Failed to log OTP error:', logError);
    }
  };

  const logError = async (context: string, error: any, userId?: string) => {
    try {
      const errorData = {
        error_type: 'general_error',
        error_message: error?.message || 'Unknown error',
        error_stack: error?.stack || null,
        context,
        user_id: userId || null,
        metadata: {
          timestamp: new Date().toISOString(),
          error_code: error?.code || null,
          error_details: error?.details || null,
          user_agent: navigator.userAgent,
          url: window.location.href
        }
      };

      await supabase.from('error_logs').insert(errorData);
    } catch (logErr) {
      console.error('Failed to log general error:', logErr);
    }
  };

  return { logAuthError, logOTPError, logError };
}
