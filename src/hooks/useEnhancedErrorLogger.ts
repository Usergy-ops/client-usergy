
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ErrorLogOptions {
  userId?: string;
  context?: string;
  metadata?: Record<string, any>;
}

export function useEnhancedErrorLogger() {
  const [isLogging, setIsLogging] = useState(false);

  const logError = async (
    error: Error | unknown,
    errorType: string,
    options: ErrorLogOptions = {}
  ) => {
    setIsLogging(true);
    
    try {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error(`[${errorType}] ${errorMessage}`, {
        stack: errorStack,
        context: options.context,
        metadata: options.metadata,
        timestamp: new Date().toISOString()
      });

      // Log to database for analysis
      const { error: logError } = await supabase
        .from('error_logs')
        .insert({
          error_type: errorType,
          error_message: errorMessage,
          error_stack: errorStack,
          context: options.context,
          user_id: options.userId,
          metadata: {
            ...options.metadata,
            timestamp: new Date().toISOString(),
            user_agent: navigator.userAgent,
            url: window.location.href
          }
        });
        
      if (logError) {
        console.warn('Failed to log error to database:', logError);
      }
    } catch (loggingError) {
      console.error('Error logging failed:', loggingError);
    } finally {
      setIsLogging(false);
    }
  };

  const logAuthError = async (
    error: Error | unknown,
    authAction: string,
    email?: string,
    additionalContext?: Record<string, any>
  ) => {
    await logError(error, `auth_${authAction}`, {
      context: `Authentication: ${authAction}`,
      metadata: {
        email,
        authAction,
        ...additionalContext
      }
    });
  };

  const logOTPError = async (
    error: Error | unknown,
    otpAction: string,
    email?: string,
    additionalContext?: Record<string, any>
  ) => {
    await logError(error, `otp_${otpAction}`, {
      context: `OTP: ${otpAction}`,
      metadata: {
        email,
        otpAction,
        ...additionalContext
      }
    });
  };

  const logNetworkError = async (
    error: Error | unknown,
    endpoint: string,
    method?: string,
    additionalContext?: Record<string, any>
  ) => {
    await logError(error, 'network_error', {
      context: `Network: ${method || 'REQUEST'} ${endpoint}`,
      metadata: {
        endpoint,
        method,
        ...additionalContext
      }
    });
  };

  return {
    logError,
    logAuthError,
    logOTPError,
    logNetworkError,
    isLogging
  };
}
