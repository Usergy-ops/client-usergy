
import { supabase } from '@/integrations/supabase/client';

interface DiagnosticResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

interface ComprehensiveDiagnostic {
  userId: string;
  userExists: boolean;
  hasAccountType: boolean;
  accountType: string | null;
  hasCompanyProfile: boolean;
  isClientVerified: boolean;
  issues: string[];
  recommendations: string[];
  rawData: {
    user?: any;
    accountType?: any;
    companyProfile?: any;
  };
}

export class ClientAccountDiagnostics {
  static async runComprehensiveDiagnostic(userId: string): Promise<DiagnosticResult> {
    const timestamp = new Date().toISOString();
    
    try {
      console.log(`Running comprehensive diagnostic for user: ${userId}`);
      
      const { data: result, error } = await supabase.rpc('diagnose_client_account_comprehensive' as any, {
        user_id_param: userId
      });

      if (error) {
        console.error('Comprehensive diagnostic RPC failed:', error);
        return {
          success: false,
          error: error.message,
          timestamp
        };
      }

      return {
        success: true,
        data: result,
        timestamp
      };
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
      
      const { data: results, error } = await supabase.rpc('test_rls_policies_for_user' as any, {
        test_user_id: userId
      });

      if (error) {
        console.error('RLS policy test failed:', error);
        return {
          success: false,
          error: error.message,
          timestamp
        };
      }

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
      hasAccountType: false,
      accountType: null,
      hasCompanyProfile: false,
      isClientVerified: false,
      issues: [],
      recommendations: [],
      rawData: {}
    };

    try {
      // Run comprehensive diagnostic
      const diagResult = await this.runComprehensiveDiagnostic(userId);
      
      if (diagResult.success && diagResult.data) {
        const data = diagResult.data;
        diagnostic.userExists = data.user_exists;
        diagnostic.hasAccountType = data.has_account_type;
        diagnostic.accountType = data.account_type;
        diagnostic.hasCompanyProfile = data.has_company_profile;
        diagnostic.isClientVerified = data.is_client_account_result;
        diagnostic.rawData = data;

        // Analyze issues
        if (!diagnostic.userExists) {
          diagnostic.issues.push('User does not exist in auth system');
        }

        if (!diagnostic.hasAccountType) {
          diagnostic.issues.push('User lacks account type assignment');
          diagnostic.recommendations.push('Run account type assignment');
        }

        if (diagnostic.accountType !== 'client') {
          diagnostic.issues.push(`Account type is '${diagnostic.accountType}', expected 'client'`);
          diagnostic.recommendations.push('Update account type to client');
        }

        if (!diagnostic.hasCompanyProfile) {
          diagnostic.issues.push('User lacks company profile');
          diagnostic.recommendations.push('Create company profile');
        }

        if (!diagnostic.isClientVerified) {
          diagnostic.issues.push('Client account verification failed');
          diagnostic.recommendations.push('Run client account creation');
        }
      } else {
        diagnostic.issues.push('Diagnostic RPC call failed');
        diagnostic.recommendations.push('Check database connectivity and RPC functions');
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
      
      const { data: result, error } = await supabase.rpc('ensure_client_account_robust' as any, {
        user_id_param: userId,
        company_name_param: userMetadata?.companyName || 'My Company',
        first_name_param: userMetadata?.contactFirstName || 'User',
        last_name_param: userMetadata?.contactLastName || ''
      });

      if (error) {
        console.error('Account repair failed:', error);
        return {
          success: false,
          error: error.message,
          timestamp
        };
      }

      const typedResult = result as any;
      return {
        success: typedResult?.success || false,
        data: result,
        error: typedResult?.error,
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
}
