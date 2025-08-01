
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { retryOperation, isRetryableError } from '@/utils/retryUtility';

interface OTPVerificationResult {
  success: boolean;
  error?: { message: string };
  data?: any;
}

export function useOTPVerification() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string>('');

  const verifyOTP = async (email: string, otpCode: string, password?: string): Promise<OTPVerificationResult> => {
    setIsVerifying(true);
    setError('');

    try {
      console.log('Using unified auth system for OTP verification:', email);

      const result = await retryOperation(
        async () => {
          const { data, error } = await supabase.functions.invoke('unified-auth', {
            body: { 
              action: 'verify-otp',
              email, 
              otpCode, 
              password 
            }
          });

          if (error) {
            throw error;
          }

          return data;
        },
        { maxRetries: 3, delay: 1000 }
      );

      if (result?.success && result?.session) {
        console.log('OTP verification successful via unified auth');
        
        // Set the session manually since we got it from the edge function
        await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token
        });

        return { success: true, data: result };
      }

      const errorMessage = result?.error || 'Invalid verification code. Please try again.';
      setError(errorMessage);
      return { success: false, error: { message: errorMessage } };

    } catch (error) {
      console.error('OTP verification exception:', error);
      
      let errorMessage = 'Network error. Please check your connection and try again.';
      
      if (error?.message?.includes('Invalid or expired')) {
        errorMessage = 'Invalid or expired verification code. Please try again or request a new code.';
      } else if (error?.message?.includes('User already exists')) {
        errorMessage = 'This email is already registered. Please try signing in instead.';
      }
      
      setError(errorMessage);
      return { success: false, error: { message: errorMessage } };
    } finally {
      setIsVerifying(false);
    }
  };

  const resendOTP = async (email: string): Promise<OTPVerificationResult> => {
    setIsResending(true);
    setError('');

    try {
      console.log('Using unified auth system for OTP resend:', email);

      const result = await retryOperation(
        async () => {
          const { data, error } = await supabase.functions.invoke('unified-auth', {
            body: { 
              action: 'resend-otp',
              email
            }
          });

          if (error) {
            throw error;
          }

          return data;
        },
        { maxRetries: 2, delay: 1500 }
      );

      if (result?.success) {
        console.log('OTP resend successful via unified auth');
        return { success: true, data: { message: 'Code resent successfully' } };
      }

      const errorMessage = result?.error || 'Failed to resend code. Please try again.';
      setError(errorMessage);
      return { success: false, error: { message: errorMessage } };

    } catch (error) {
      console.error('OTP resend exception:', error);
      const errorMessage = 'Failed to resend code. Please try again.';
      setError(errorMessage);
      return { success: false, error: { message: errorMessage } };
    } finally {
      setIsResending(false);
    }
  };

  const reset = () => {
    setError('');
  };

  return {
    isVerifying,
    isResending,
    error,
    verifyOTP,
    resendOTP,
    reset
  };
}
