
import { supabase } from '@/integrations/supabase/client';

interface EnhancedDiagnosticResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
  source: string;
}

interface UserExistenceCheck {
  exists: boolean;
  source: string;
  userDetails?: any;
  diagnostic: any;
}

export class EnhancedClientAccountDiagnostics {
  static async runComprehensiveUserCheck(email: string): Promise<EnhancedDiagnosticResult> {
    const timestamp = new Date().toISOString();
    
    try {
      console.log(`Running enhanced comprehensive user check for email: ${email}`);
      
      // Check via edge function for the most accurate result
      const { data: result, error } = await supabase.functions.invoke('client-auth-handler/check-user', {
        body: { email }
      });

      if (error) {
        console.error('Enhanced diagnostic edge function failed:', error);
        return {
          success: false,
          error: error.message,
          timestamp,
          source: 'edge_function_error'
        };
      }

      return {
        success: true,
        data: result,
        timestamp,
        source: 'edge_function'
      };
    } catch (error) {
      console.error('Enhanced diagnostic exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown enhanced diagnostic error',
        timestamp,
        source: 'exception'
      };
    }
  }

  static async diagnoseSignupFailure(email: string, errorMessage: string): Promise<EnhancedDiagnosticResult> {
    const timestamp = new Date().toISOString();
    
    try {
      console.log(`Diagnosing signup failure for ${email}: ${errorMessage}`);
      
      const diagnostic = {
        email,
        error_message: errorMessage,
        timestamp,
        checks: {} as any
      };

      // Run comprehensive user check
      const userCheck = await this.runComprehensiveUserCheck(email);
      diagnostic.checks.user_existence = userCheck;

      // Check for recent signup attempts
      try {
        const { data: otpAttempts, error: otpError } = await supabase
          .from('user_otp_verification')
          .select('*')
          .eq('email', email)
          .order('created_at', { ascending: false })
          .limit(5);

        if (otpError) {
          diagnostic.checks.otp_attempts = { error: otpError.message };
        } else {
          diagnostic.checks.otp_attempts = {
            count: otpAttempts?.length || 0,
            recent_attempts: otpAttempts?.map(attempt => ({
              created_at: attempt.created_at,
              verified_at: attempt.verified_at,
              expires_at: attempt.expires_at
            })) || []
          };
        }
      } catch (error) {
        diagnostic.checks.otp_attempts = { error: error instanceof Error ? error.message : 'Unknown error' };
      }

      // Check account types
      try {
        const { data: accountTypes, error: accountError } = await supabase
          .from('account_types')
          .select('*')
          .eq('account_type', 'client');

        if (accountError) {
          diagnostic.checks.account_types = { error: accountError.message };
        } else {
          diagnostic.checks.account_types = {
            total_client_accounts: accountTypes?.length || 0
          };
        }
      } catch (error) {
        diagnostic.checks.account_types = { error: error instanceof Error ? error.message : 'Unknown error' };
      }

      return {
        success: true,
        data: diagnostic,
        timestamp,
        source: 'signup_failure_diagnosis'
      };

    } catch (error) {
      console.error('Signup failure diagnosis exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown diagnosis error',
        timestamp,
        source: 'diagnosis_exception'
      };
    }
  }

  static async testEdgeFunctionHealth(): Promise<EnhancedDiagnosticResult> {
    const timestamp = new Date().toISOString();
    
    try {
      console.log('Testing enhanced edge function health...');
      
      const { data: result, error } = await supabase.functions.invoke('client-auth-handler/health', {
        body: { test: true }
      });

      if (error) {
        return {
          success: false,
          error: error.message,
          timestamp,
          source: 'edge_function_health_error'
        };
      }

      return {
        success: true,
        data: result,
        timestamp,
        source: 'edge_function_health'
      };

    } catch (error) {
      console.error('Edge function health test exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown health test error',
        timestamp,
        source: 'health_test_exception'
      };
    }
  }

  static async logDiagnosticEvent(event: string, data: any) {
    try {
      await supabase.from('error_logs').insert({
        error_type: 'diagnostic_event',
        error_message: event,
        context: 'enhanced_client_diagnostics',
        metadata: {
          event,
          data,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Failed to log diagnostic event:', error);
    }
  }
}
