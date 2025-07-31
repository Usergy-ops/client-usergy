
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
      // Use the standard Supabase auth verifyOtp method for email verification
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'signup'
      });

      if (error) {
        setError('Verification failed. Please try again.');
        return { success: false, error: { message: 'Verification failed' } };
      }

      if (data.session) {
        return { success: true, data };
      }

      setError('Invalid verification code');
      return { success: false, error: { message: 'Invalid verification code' } };
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
      // Use the standard Supabase auth resend method
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email
      });

      if (error) {
        setError('Failed to resend code. Please try again.');
        return { success: false, error: { message: 'Failed to resend code' } };
      }

      return { success: true, data: { message: 'Code resent successfully' } };
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
