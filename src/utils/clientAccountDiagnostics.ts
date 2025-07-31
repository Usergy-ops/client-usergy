
import { supabase } from '@/integrations/supabase/client';
import { SimplifiedClientDiagnostics } from './simplifiedClientDiagnostics';

interface DiagnosticResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

interface ComprehensiveDiagnostic {
  userId: string;
  userExists: boolean;
  hasClientRecord: boolean;
  clientRecord: any;
  isClientVerified: boolean;
  issues: string[];
  recommendations: string[];
  rawData: {
    user?: any;
    clientRecord?: any;
  };
}

export class ClientAccountDiagnostics {
  static async runComprehensiveDiagnostic(userId: string): Promise<DiagnosticResult> {
    const timestamp = new Date().toISOString();
    
    try {
      console.log(`Running comprehensive diagnostic for user: ${userId}`);
      
      // Use simplified diagnostics
      const result = await SimplifiedClientDiagnostics.checkUserAccountStatus(userId);
      
      if (result.success) {
        return {
          success: true,
          data: {
            ...result.data,
            user_exists: result.data?.userExists || false,
            has_client_record: result.data?.hasClientRecord || false,
            client_record: result.data?.clientRecord || null,
            is_client_account: result.data?.hasClientRecord || false,
            session_valid: result.data?.sessionValid || false
          },
          timestamp
        };
      } else {
        return result;
      }
    } catch (error) {
      console.error('Diagnostic exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown diagnostic error',
        timestamp
      };
    }
  }

  static async checkRLSPolicies(userId: string): Promise<DiagnosticResult> {
    const timestamp = new Date().toISOString();
    
    try {
      console.log(`Testing RLS policies for user: ${userId}`);
      
      // Test RPC function access
      const { data: rpcResult, error: rpcError } = await supabase
        .rpc('is_client_account', { user_id_param: userId });

      const results = [
        {
          function_name: 'is_client_account',
          operation: 'RPC CALL',
          can_access: !rpcError,
          error_message: rpcError?.message || null,
          result: rpcResult
        }
      ];

      return {
        success: true,
        data: results,
        timestamp
      };
    } catch (error) {
      console.error('RLS test exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown RLS test error',
        timestamp
      };
    }
  }

  static async validateClientAccountIntegrity(userId: string): Promise<ComprehensiveDiagnostic> {
    const diagnostic: ComprehensiveDiagnostic = {
      userId,
      userExists: false,
      hasClientRecord: false,
      clientRecord: null,
      isClientVerified: false,
      issues: [],
      recommendations: [],
      rawData: {}
    };

    try {
      const diagResult = await this.runComprehensiveDiagnostic(userId);
      
      if (diagResult.success && diagResult.data) {
        const data = diagResult.data;
        diagnostic.userExists = data.user_exists;
        diagnostic.hasClientRecord = data.has_client_record;
        diagnostic.clientRecord = data.client_record;
        diagnostic.isClientVerified = data.is_client_account;
        diagnostic.rawData = data;

        // Analyze issues
        if (!diagnostic.userExists) {
          diagnostic.issues.push('User does not exist in auth system');
        }

        if (!diagnostic.hasClientRecord) {
          diagnostic.issues.push('User lacks client record in client_workflow schema');
          diagnostic.recommendations.push('Client record will be created automatically');
        }

        if (!diagnostic.isClientVerified) {
          diagnostic.issues.push('Client account verification failed');
          diagnostic.recommendations.push('Ensure proper client record creation');
        }
      } else {
        diagnostic.issues.push('Diagnostic check failed');
        diagnostic.recommendations.push('Check database connectivity and user authentication');
      }

    } catch (error) {
      diagnostic.issues.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    return diagnostic;
  }

  static async repairClientAccount(userId: string, userMetadata?: any): Promise<DiagnosticResult> {
    const timestamp = new Date().toISOString();
    
    try {
      console.log(`Attempting to repair client account for user: ${userId}`);
      
      // Get user info
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || user.id !== userId) {
        return {
          success: false,
          error: 'User not found or not authenticated',
          timestamp
        };
      }

      // Use simplified client record creation
      const result = await SimplifiedClientDiagnostics.ensureClientRecord(userId, user.email!, userMetadata || {});
      
      return {
        success: result.success,
        data: result.data,
        error: result.error,
        timestamp
      };

    } catch (error) {
      console.error('Repair exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown repair error',
        timestamp
      };
    }
  }

  static async testSimplifiedTrigger(userEmail: string): Promise<DiagnosticResult> {
    const timestamp = new Date().toISOString();
    
    try {
      console.log('Testing simplified client setup...');
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || user.email !== userEmail) {
        return {
          success: false,
          error: 'User not found or email mismatch',
          timestamp
        };
      }

      // Check if the user has the expected client record using RPC
      const { data: isClient } = await supabase
        .rpc('is_client_account', { user_id_param: user.id });

      return {
        success: true,
        data: {
          user_id: user.id,
          email: user.email,
          has_client_record: !!isClient,
          simplified_mode: true,
          setup_working: !!isClient
        },
        timestamp
      };
      
    } catch (error) {
      console.error('Simplified test exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown test error',
        timestamp
      };
    }
  }

  // Legacy compatibility method
  static async isClientAccount(userId: string): Promise<boolean> {
    return await SimplifiedClientDiagnostics.isClientAccount(userId);
  }
}
