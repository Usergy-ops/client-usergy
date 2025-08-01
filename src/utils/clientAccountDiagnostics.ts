
import { supabase } from '@/integrations/supabase/client';

interface DiagnosticResult {
  success: boolean;
  userId: string;
  userExists: boolean;
  hasClientRecord: boolean;
  isClientVerified: boolean;
  issues: string[];
  recommendations: string[];
  data?: any;
}

export class ClientAccountDiagnostics {
  static async runComprehensiveDiagnostic(userId: string): Promise<DiagnosticResult> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check if user exists in auth
      const { data: user } = await supabase.auth.getUser();
      const userExists = user.user?.id === userId;

      if (!userExists) {
        issues.push('User not found in authentication system');
        recommendations.push('User may need to sign in again');
      }

      // Check if user is a client using RPC function
      const hasClientRecord = await this.isClientAccount(userId);
      if (!hasClientRecord) {
        issues.push('No client record found');
        recommendations.push('Client account needs to be created');
      }

      // Check account type using RPC function
      const { data: debugInfo } = await supabase
        .rpc('get_user_debug_info', { user_id_param: userId });

      // Safely access the account type from the debug info
      const accountType = debugInfo && typeof debugInfo === 'object' && debugInfo !== null
        ? (debugInfo as any).account_type_info?.account_type
        : null;
      
      const isClientVerified = accountType === 'client';
      
      if (!isClientVerified) {
        issues.push('Account type is not set to client');
        recommendations.push('Account type needs to be updated to client');
      }

      return {
        success: true,
        userId,
        userExists,
        hasClientRecord,
        isClientVerified,
        issues,
        recommendations,
        data: {
          debugInfo,
          accountType
        }
      };
    } catch (error) {
      console.error('Diagnostic error:', error);
      return {
        success: false,
        userId,
        userExists: false,
        hasClientRecord: false,
        isClientVerified: false,
        issues: ['Failed to run diagnostic'],
        recommendations: ['Please try again or contact support']
      };
    }
  }

  static async isClientAccount(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('is_client_account', { user_id_param: userId });

      if (error) {
        console.error('Error checking client account status:', error);
        return false;
      }

      return data || false;
    } catch (error) {
      console.error('Exception checking client account status:', error);
      return false;
    }
  }

  static async repairClientAccount(userId: string, userMetadata?: any): Promise<{ success: boolean; message: string }> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        return { success: false, message: 'User not authenticated' };
      }

      // Use the ensure client account RPC function
      const { data, error } = await supabase
        .rpc('ensure_client_account', {
          user_id_param: userId,
          company_name_param: userMetadata?.companyName || 'My Company',
          first_name_param: userMetadata?.firstName || '',
          last_name_param: userMetadata?.lastName || ''
        });

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, message: 'Account repaired successfully' };
    } catch (error) {
      console.error('Account repair error:', error);
      return { success: false, message: 'Failed to repair account' };
    }
  }

  static async checkRLSPolicies(userId: string) {
    try {
      const results = [];
      
      // Test account_types table access
      const { data: accountTypes, error: accountTypesError } = await supabase
        .from('account_types')
        .select('*')
        .eq('auth_user_id', userId);

      results.push({
        table_name: 'account_types',
        operation: 'select',
        can_access: !accountTypesError,
        error_message: accountTypesError?.message
      });

      // Test profiles table access
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId);

      results.push({
        table_name: 'profiles',
        operation: 'select',
        can_access: !profilesError,
        error_message: profilesError?.message
      });

      return { success: true, data: results };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  static async testSimplifiedTrigger(email: string) {
    try {
      const { data, error } = await supabase
        .rpc('get_user_debug_info', { 
          user_id_param: (await supabase.auth.getUser()).data.user?.id 
        });

      if (error) {
        return { success: false, error: error.message };
      }

      // Safely access the debug info
      const debugInfo = data as any;
      
      return {
        success: true,
        data: {
          user_id: debugInfo?.auth_info?.id,
          email: debugInfo?.auth_info?.email,
          has_account_type: !!debugInfo?.account_type_info?.account_type,
          account_type: debugInfo?.account_type_info?.account_type,
          has_company_profile: !!debugInfo?.auth_info?.user_metadata?.companyName,
          company_name: debugInfo?.auth_info?.user_metadata?.companyName
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
