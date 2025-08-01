
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EmailTestResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export function useEmailSystemTest() {
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();

  const testEmailDelivery = async (email: string): Promise<EmailTestResult> => {
    setTesting(true);
    
    try {
      console.log('Testing email delivery system for:', email);
      
      const { data, error } = await supabase.functions.invoke('unified-auth', {
        body: { 
          action: 'signup',
          email,
          password: 'TestPassword123',
          companyName: 'Email Test Company',
          firstName: 'Test',
          lastName: 'User',
          accountType: 'client',
          sourceUrl: window.location.origin
        }
      });

      if (error) {
        console.error('Email delivery test error:', error);
        return {
          success: false,
          message: 'Email delivery test failed',
          error: error.message
        };
      }

      const success = data?.success && data?.emailSent;
      
      return {
        success,
        message: success 
          ? 'Email delivery test successful - check your inbox!' 
          : 'Email system responded but delivery may have failed',
        data
      };

    } catch (error) {
      console.error('Email delivery test exception:', error);
      return {
        success: false,
        message: 'Network error during email test',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      setTesting(false);
    }
  };

  const testOTPResend = async (email: string): Promise<EmailTestResult> => {
    setTesting(true);
    
    try {
      console.log('Testing OTP resend for:', email);
      
      const { data, error } = await supabase.functions.invoke('unified-auth', {
        body: { 
          action: 'resend-otp',
          email
        }
      });

      if (error) {
        console.error('OTP resend test error:', error);
        return {
          success: false,
          message: 'OTP resend test failed',
          error: error.message
        };
      }

      const success = data?.success && data?.emailSent;
      
      return {
        success,
        message: success 
          ? 'OTP resend test successful - new code sent!' 
          : 'OTP resend responded but email may not have been sent',
        data
      };

    } catch (error) {
      console.error('OTP resend test exception:', error);
      return {
        success: false,
        message: 'Network error during OTP resend test',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      setTesting(false);
    }
  };

  const testOTPVerification = async (email: string, otpCode: string): Promise<EmailTestResult> => {
    setTesting(true);
    
    try {
      console.log('Testing OTP verification for:', email, 'with code:', otpCode);
      
      const { data, error } = await supabase.functions.invoke('unified-auth', {
        body: { 
          action: 'verify-otp',
          email,
          otpCode,
          password: 'TestPassword123'
        }
      });

      if (error) {
        console.error('OTP verification test error:', error);
        return {
          success: false,
          message: 'OTP verification test failed',
          error: error.message
        };
      }

      const success = data?.success;
      
      return {
        success,
        message: success 
          ? 'OTP verification test successful!' 
          : data?.error || 'OTP verification failed',
        data
      };

    } catch (error) {
      console.error('OTP verification test exception:', error);
      return {
        success: false,
        message: 'Network error during OTP verification test',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      setTesting(false);
    }
  };

  return {
    testing,
    testEmailDelivery,
    testOTPResend,
    testOTPVerification
  };
}
