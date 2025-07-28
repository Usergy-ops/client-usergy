
import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface ErrorLogParams {
  errorType: string;
  errorMessage: string;
  errorStack?: string;
  context?: string;
  metadata?: Record<string, any>;
}

export function useErrorLogger() {
  const logError = useCallback(async (params: ErrorLogParams) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.from('error_logs').insert({
        error_type: params.errorType,
        error_message: params.errorMessage,
        error_stack: params.errorStack,
        context: params.context,
        user_id: user?.id || null,
        metadata: params.metadata || {},
      });
    } catch (error) {
      console.error('Failed to log error:', error);
    }
  }, []);

  const logAuthError = useCallback(async (error: any, context: string) => {
    await logError({
      errorType: 'authentication',
      errorMessage: error.message || 'Authentication error',
      errorStack: error.stack,
      context,
      metadata: {
        errorCode: error.code,
        timestamp: new Date().toISOString(),
      },
    });
  }, [logError]);

  const logOTPError = useCallback(async (error: any, context: string, email?: string) => {
    await logError({
      errorType: 'otp_verification',
      errorMessage: error.message || 'OTP verification error',
      errorStack: error.stack,
      context,
      metadata: {
        email: email || 'unknown',
        errorCode: error.code,
        timestamp: new Date().toISOString(),
      },
    });
  }, [logError]);

  return {
    logError,
    logAuthError,
    logOTPError,
  };
}
