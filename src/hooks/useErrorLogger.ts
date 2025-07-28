
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

  return { logAuthError };
}
