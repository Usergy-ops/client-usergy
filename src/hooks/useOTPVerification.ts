
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

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

      const { data, error } = await supabase.functions.invoke('unified-auth', {
        body: { 
          action: 'verify-otp',
          email, 
          otpCode, 
          password 
        }
      });

      if (error) {
        console.error('Unified auth verification error:', error);
        setError('Verification failed. Please try again.');
        return { success: false, error: { message: error.message || 'Verification failed' } };
      }

      if (data?.success && data?.session) {
        console.log('OTP verification successful via unified auth');
        
        // Set the session manually since we got it from the edge function
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });

        return { success: true, data };
      }

      const errorMessage = data?.error || 'Invalid verification code. Please try again.';
      setError(errorMessage);
      return { success: false, error: { message: errorMessage } };

    } catch (error) {
      console.error('OTP verification exception:', error);
      const errorMessage = 'Network error. Please check your connection and try again.';
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

      const { data, error } = await supabase.functions.invoke('unified-auth', {
        body: { 
          action: 'resend-otp',
          email
        }
      });

      if (error) {
        console.error('Unified auth resend error:', error);
        setError('Failed to resend code. Please try again.');
        return { success: false, error: { message: error.message || 'Failed to resend code' } };
      }

      if (data?.success) {
        console.log('OTP resend successful via unified auth');
        return { success: true, data: { message: 'Code resent successfully' } };
      }

      const errorMessage = data?.error || 'Failed to resend code. Please try again.';
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
