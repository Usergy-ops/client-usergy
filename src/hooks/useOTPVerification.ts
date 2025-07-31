
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
      const { data, error } = await supabase.functions.invoke('client-auth-handler/verify-otp', {
        body: { email, otpCode, password }
      });

      if (error) {
        setError('Verification failed. Please try again.');
        return { success: false, error: { message: 'Verification failed' } };
      }

      if (data?.success) {
        return { success: true, data };
      }

      setError(data?.error || 'Invalid verification code');
      return { success: false, error: { message: data?.error || 'Invalid verification code' } };
    } catch (error) {
      console.error('OTP verification error:', error);
      setError('Verification failed. Please try again.');
      return { success: false, error: { message: 'Verification failed' } };
    } finally {
      setIsVerifying(false);
    }
  };

  const resendOTP = async (email: string): Promise<OTPVerificationResult> => {
    setIsResending(true);
    setError('');

    try {
      const { data, error } = await supabase.functions.invoke('client-auth-handler/resend-otp', {
        body: { email }
      });

      if (error) {
        setError('Failed to resend code. Please try again.');
        return { success: false, error: { message: 'Failed to resend code' } };
      }

      if (data?.success) {
        return { success: true, data };
      }

      setError(data?.error || 'Failed to resend code');
      return { success: false, error: { message: data?.error || 'Failed to resend code' } };
    } catch (error) {
      console.error('OTP resend error:', error);
      setError('Failed to resend code. Please try again.');
      return { success: false, error: { message: 'Failed to resend code' } };
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
