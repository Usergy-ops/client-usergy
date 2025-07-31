
import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface OTPMonitoringEvent {
  event_type: 'otp_requested' | 'otp_verified' | 'account_created' | 'navigation_started' | 'navigation_completed';
  email: string;
  user_id?: string;
  step?: string;
  success?: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export function useOTPMonitoring() {
  const logEvent = useCallback(async (event: OTPMonitoringEvent) => {
    try {
      console.log('📊 OTP Monitoring Event:', event);
      
      // Log to Supabase error logs for monitoring
      const { error } = await supabase.from('error_logs').insert({
        error_type: 'otp_monitoring',
        error_message: event.event_type,
        context: 'otp_verification_flow',
        user_id: event.user_id,
        metadata: {
          ...event,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
          url: window.location.href
        }
      });

      if (error) {
        console.warn('Failed to log monitoring event:', error);
      }
    } catch (error) {
      console.warn('Exception logging monitoring event:', error);
    }
  }, []);

  const trackOTPRequest = useCallback((email: string) => {
    logEvent({
      event_type: 'otp_requested',
      email,
      success: true
    });
  }, [logEvent]);

  const trackOTPVerification = useCallback((email: string, user_id?: string, success: boolean = true, error?: string) => {
    logEvent({
      event_type: 'otp_verified',
      email,
      user_id,
      success,
      error
    });
  }, [logEvent]);

  const trackAccountCreation = useCallback((email: string, user_id: string, success: boolean = true, error?: string) => {
    logEvent({
      event_type: 'account_created',
      email,
      user_id,
      success,
      error
    });
  }, [logEvent]);

  const trackNavigation = useCallback((email: string, user_id?: string, step: string, success: boolean = true) => {
    logEvent({
      event_type: step === 'started' ? 'navigation_started' : 'navigation_completed',
      email,
      user_id,
      step,
      success
    });
  }, [logEvent]);

  return {
    trackOTPRequest,
    trackOTPVerification,
    trackAccountCreation,
    trackNavigation,
    logEvent
  };
}
