
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
      
      const { data: result, error } = await supabase.rpc('get_client_account_status', {
        user_id_param: userId
      });

      if (error) {
        console.error('Diagnostic RPC failed:', error);
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
      
      // Test basic account_types access
      const { data: accountTypes, error: accountError } = await supabase
        .from('account_types')
        .select('*')
        .eq('auth_user_id', userId);

      if (accountError) {
        console.error('Account types RLS test failed:', accountError);
        return {
          success: false,
          error: accountError.message,
          timestamp
        };
      }

      // Test company_profiles access - note: we can't use .schema() in the client
      // We'll need to create a view or function for this if needed
      const results = [
        {
          table_name: 'account_types',
          operation: 'SELECT',
          can_access: !accountError,
          error_message: accountError?.message || null
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
      hasAccountType: false,
      accountType: null,
      hasCompanyProfile: false,
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
        diagnostic.hasAccountType = data.account_type_exists;
        diagnostic.accountType = data.account_type;
        diagnostic.hasCompanyProfile = data.company_profile_exists;
        diagnostic.isClientVerified = data.is_client_account;
        diagnostic.rawData = data;

        // Analyze issues
        if (!diagnostic.userExists) {
          diagnostic.issues.push('User does not exist in auth system');
        }

        if (!diagnostic.hasAccountType) {
          diagnostic.issues.push('User lacks account type assignment');
          diagnostic.recommendations.push('Run client account creation');
        }

        if (diagnostic.accountType !== 'client') {
          diagnostic.issues.push(`Account type is '${diagnostic.accountType}', expected 'client'`);
          diagnostic.recommendations.push('Run client account creation to fix account type');
        }

        if (!diagnostic.hasCompanyProfile) {
          diagnostic.issues.push('User lacks company profile');
          diagnostic.recommendations.push('Create company profile using robust function');
        }

        if (!diagnostic.isClientVerified) {
          diagnostic.issues.push('Client account verification failed');
          diagnostic.recommendations.push('Run ensure_client_account_robust function');
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
      
      const { data: rawResult, error } = await supabase.rpc('ensure_client_account_robust', {
        user_id_param: userId,
        company_name_param: userMetadata?.companyName || userMetadata?.company_name || 'My Company',
        first_name_param: userMetadata?.contactFirstName || 
          userMetadata?.first_name ||
          userMetadata?.full_name?.split(' ')[0] || 'User',
        last_name_param: userMetadata?.contactLastName || 
          userMetadata?.last_name ||
          userMetadata?.full_name?.split(' ').slice(1).join(' ') || ''
      });

      if (error) {
        console.error('Account repair failed:', error);
        return {
          success: false,
          error: error.message,
          timestamp
        };
      }

      // Type guard for the result
      const result = rawResult as unknown as any;
      return {
        success: result?.success || false,
        data: rawResult,
        error: result?.error,
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
      console.log('Testing simplified client signup trigger...');
      
      // This diagnostic function is simplified since we can't access auth.admin from client
      // Instead, we'll check if the current user has the expected setup
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || user.email !== userEmail) {
        return {
          success: false,
          error: 'User not found or email mismatch',
          timestamp
        };
      }

      // Check if the trigger created the necessary records
      const { data: accountType } = await supabase
        .from('account_types')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();

      return {
        success: true,
        data: {
          user_id: user.id,
          email: user.email,
          has_account_type: !!accountType,
          account_type: accountType?.account_type,
          trigger_working: !!accountType
        },
        timestamp
      };
      
    } catch (error) {
      console.error('Trigger test exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown trigger test error',
        timestamp
      };
    }
  }
}
