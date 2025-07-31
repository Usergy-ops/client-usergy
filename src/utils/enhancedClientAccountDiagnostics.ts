
import { supabase } from '@/integrations/supabase/client';
import { SimplifiedClientDiagnostics } from './simplifiedClientDiagnostics';

interface EnhancedDiagnosticResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
  source: string;
}

export class EnhancedClientAccountDiagnostics {
  static async runComprehensiveUserCheck(email: string): Promise<EnhancedDiagnosticResult> {
    const timestamp = new Date().toISOString();
    
    try {
      console.log(`Running enhanced comprehensive user check for email: ${email}`);
      
      // Get current user info
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return {
          success: false,
          error: 'No authenticated user found',
          timestamp,
          source: 'no_user'
        };
      }

      if (user.email !== email) {
        return {
          success: false,
          error: 'Email mismatch with authenticated user',
          timestamp,
          source: 'email_mismatch'
        };
      }

      // Use simplified diagnostics
      const statusResult = await SimplifiedClientDiagnostics.checkUserAccountStatus(user.id);
      
      return {
        success: statusResult.success,
        data: {
          user_id: user.id,
          email: user.email,
          status: statusResult.data,
          enhanced: true
        },
        error: statusResult.error,
        timestamp,
        source: 'enhanced_comprehensive_check'
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

      // Get current user if any
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Run comprehensive check if user exists
        const userCheck = await this.runComprehensiveUserCheck(email);
        diagnostic.checks.user_existence = userCheck;
      } else {
        diagnostic.checks.user_existence = {
          exists: false,
          reason: 'no_authenticated_user'
        };
      }

      // Test RPC function access
      try {
        const { data: rpcTest, error: rpcError } = await supabase
          .rpc('is_client_account', { user_id_param: user?.id || '00000000-0000-0000-0000-000000000000' });

        diagnostic.checks.rpc_function = {
          accessible: !rpcError,
          error: rpcError?.message || null,
          result: rpcTest
        };
      } catch (error) {
        diagnostic.checks.rpc_function = { error: error instanceof Error ? error.message : 'Unknown error' };
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
      
      // Test RPC function connectivity
      const { data: testResult, error } = await supabase
        .rpc('is_client_account', { user_id_param: '00000000-0000-0000-0000-000000000000' });

      if (error) {
        return {
          success: false,
          error: `RPC function connectivity test failed: ${error.message}`,
          timestamp,
          source: 'rpc_connectivity_test_failed'
        };
      }

      return {
        success: true,
        data: {
          rpc_function_accessible: true,
          simplified_mode: true,
          message: 'Using simplified client diagnostics with RPC functions'
        },
        timestamp,
        source: 'simplified_health_check'
      };

    } catch (error) {
      console.error('Health test exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown health test error',
        timestamp,
        source: 'health_test_exception'
      };
    }
  }

  static async logDiagnosticEvent(event: string, data: any) {
    await SimplifiedClientDiagnostics.logDiagnosticEvent(event, data);
  }
}
