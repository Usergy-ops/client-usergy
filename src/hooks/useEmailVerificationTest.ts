
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface EmailTestResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export function useEmailVerificationTest() {
  const [testing, setTesting] = useState(false);

  const testEmailSystem = async (): Promise<EmailTestResult> => {
    setTesting(true);
    
    try {
      console.log('Testing email verification system...');
      
      // Test edge function connectivity
      const { data, error } = await supabase.functions.invoke('unified-auth', {
        body: { 
          action: 'signup',
          email: 'test@example.com',
          password: 'test123',
          companyName: 'Test Company',
          firstName: 'Test',
          lastName: 'User',
          accountType: 'client',
          sourceUrl: window.location.origin
        }
      });

      if (error) {
        return {
          success: false,
          message: 'Edge function test failed',
          error: error.message
        };
      }

      // Check if email configuration is working
      const hasResendKey = data?.debug?.resend_configured || false;
      
      return {
        success: true,
        message: `Email system test completed. Resend configured: ${hasResendKey}`,
        data: {
          edge_function_working: true,
          resend_configured: hasResendKey,
          response: data
        }
      };

    } catch (error) {
      console.error('Email verification test error:', error);
      return {
        success: false,
        message: 'Email verification test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      setTesting(false);
    }
  };

  const testOTPFlow = async (email: string): Promise<EmailTestResult> => {
    setTesting(true);
    
    try {
      console.log('Testing OTP flow for:', email);
      
      // Test signup flow
      const signupResult = await supabase.functions.invoke('unified-auth', {
        body: { 
          action: 'signup',
          email,
          password: 'test123',
          companyName: 'Test Company',
          accountType: 'client',
          sourceUrl: window.location.origin
        }
      });

      if (signupResult.error) {
        return {
          success: false,
          message: 'Signup test failed',
          error: signupResult.error.message
        };
      }

      // Test resend functionality
      const resendResult = await supabase.functions.invoke('unified-auth', {
        body: { 
          action: 'resend-otp',
          email
        }
      });

      return {
        success: true,
        message: 'OTP flow test completed successfully',
        data: {
          signup_result: signupResult.data,
          resend_result: resendResult.data,
          email_sent: signupResult.data?.emailSent || false
        }
      };

    } catch (error) {
      console.error('OTP flow test error:', error);
      return {
        success: false,
        message: 'OTP flow test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      setTesting(false);
    }
  };

  return {
    testing,
    testEmailSystem,
    testOTPFlow
  };
}
