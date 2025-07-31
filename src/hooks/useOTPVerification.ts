
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface OTPVerificationState {
  isVerifying: boolean;
  isResending: boolean;
  error: string | null;
  isSuccess: boolean;
}

export function useOTPVerification() {
  const [state, setState] = useState<OTPVerificationState>({
    isVerifying: false,
    isResending: false,
    error: null,
    isSuccess: false,
  });

  const verifyOTP = useCallback(async (email: string, otpCode: string, password?: string) => {
    setState(prev => ({ ...prev, isVerifying: true, error: null }));

    try {
      const { data, error } = await supabase.functions.invoke('client-auth-handler/verify-otp', {
        body: { email, otpCode, password }
      });

      if (error) {
        setState(prev => ({ 
          ...prev, 
          isVerifying: false, 
          error: 'Invalid verification code. Please try again.' 
        }));
        return { success: false, error };
      }

      if (data && data.success) {
        setState(prev => ({ 
          ...prev, 
          isVerifying: false, 
          isSuccess: true 
        }));
        return { success: true, data };
      } else {
        setState(prev => ({ 
          ...prev, 
          isVerifying: false, 
          error: data?.error || 'Invalid verification code. Please try again.' 
        }));
        return { success: false, error: data?.error };
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isVerifying: false, 
        error: 'An error occurred. Please try again.' 
      }));
      return { success: false, error };
    }
  }, []);

  const resendOTP = useCallback(async (email: string) => {
    setState(prev => ({ ...prev, isResending: true, error: null }));

    try {
      const { data, error } = await supabase.functions.invoke('client-auth-handler/resend-otp', {
        body: { email }
      });

      if (error) {
        setState(prev => ({ 
          ...prev, 
          isResending: false, 
          error: 'Failed to resend verification code. Please try again.' 
        }));
        return { success: false, error };
      }

      if (data && data.success) {
        setState(prev => ({ ...prev, isResending: false }));
        return { success: true };
      } else {
        setState(prev => ({ 
          ...prev, 
          isResending: false, 
          error: 'Failed to resend verification code. Please try again.' 
        }));
        return { success: false, error: data?.error };
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isResending: false, 
        error: 'Failed to resend verification code. Please try again.' 
      }));
      return { success: false, error };
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      isVerifying: false,
      isResending: false,
      error: null,
      isSuccess: false,
    });
  }, []);

  return {
    ...state,
    verifyOTP,
    resendOTP,
    reset,
  };
}
