
import { useState, useCallback } from 'react';

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

  const verifyOTP = useCallback(async (email: string, otpCode: string) => {
    setState(prev => ({ ...prev, isVerifying: true, error: null }));

    try {
      const response = await fetch(`https://lnsyrmpucmllakuuiixe.supabase.co/functions/v1/client-auth-handler`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxuc3lybXB1Y21sbGFrdXVpaXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNTI5MjQsImV4cCI6MjA2ODkyODkyNH0.kgdtlLTMLEHMBidAAB7fqP9_RhPXsqwI2Tv-TmmyF3Y`
        },
        body: JSON.stringify({ 
          action: 'verify-otp',
          email, 
          otpCode 
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setState(prev => ({ 
          ...prev, 
          isVerifying: false, 
          error: 'Invalid verification code. Please try again.' 
        }));
        return { success: false, error: data.error };
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
      const response = await fetch(`https://lnsyrmpucmllakuuiixe.supabase.co/functions/v1/client-auth-handler`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxuc3lybXB1Y21sbGFrdXVpaXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNTI5MjQsImV4cCI6MjA2ODkyODkyNH0.kgdtlLTMLEHMBidAAB7fqP9_RhPXsqwI2Tv-TmmyF3Y`
        },
        body: JSON.stringify({ 
          action: 'resend-otp',
          email 
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setState(prev => ({ 
          ...prev, 
          isResending: false, 
          error: 'Failed to resend verification code. Please try again.' 
        }));
        return { success: false, error: data.error };
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
