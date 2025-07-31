
import { supabase } from '@/lib/supabase';

interface DiagnosticResult {
  success: boolean;
  userId: string;
  userExists: boolean;
  hasClientRecord: boolean;
  hasCompanyProfile: boolean;
  isClientVerified: boolean;
  issues: string[];
  recommendations: string[];
  data?: any;
}

interface RLSTestResult {
  success: boolean;
  data?: Array<{
    table_name: string;
    operation: string;
    can_access: boolean;
    error_message?: string;
  }>;
  error?: string;
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

      // Check client record
      const { data: clientData } = await supabase
        .from('client_workflow.clients')
        .select('*')
        .eq('auth_user_id', userId)
        .single();

      const hasClientRecord = !!clientData;
      if (!hasClientRecord) {
        issues.push('No client record found');
        recommendations.push('Client account needs to be created');
      }

      // Check company profile
      const { data: companyProfile } = await supabase
        .from('client_workspace.company_profiles')
        .select('*')
        .eq('auth_user_id', userId)
        .single();

      const hasCompanyProfile = !!companyProfile;
      if (!hasCompanyProfile) {
        issues.push('No company profile found');
        recommendations.push('Company profile needs to be completed');
      }

      // Check account type
      const { data: accountType } = await supabase
        .from('account_types')
        .select('account_type')
        .eq('auth_user_id', userId)
        .single();

      const isClientVerified = accountType?.account_type === 'client';
      if (!isClientVerified) {
        issues.push('Account type is not set to client');
        recommendations.push('Account type needs to be updated to client');
      }

      return {
        success: true,
        userId,
        userExists,
        hasClientRecord,
        hasCompanyProfile,
        isClientVerified,
        issues,
        recommendations,
        data: {
          clientData,
          companyProfile,
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
        hasCompanyProfile: false,
        isClientVerified: false,
        issues: ['Failed to run diagnostic'],
        recommendations: ['Please try again or contact support']
      };
    }
  }

  static async validateClientAccountIntegrity(userId: string): Promise<DiagnosticResult> {
    return this.runComprehensiveDiagnostic(userId);
  }

  static async repairClientAccount(userId: string, userMetadata?: any): Promise<{ success: boolean; message: string }> {
    try {
      // Create client record if missing
      const { data: existingClient } = await supabase
        .from('client_workflow.clients')
        .select('*')
        .eq('auth_user_id', userId)
        .single();

      if (!existingClient) {
        const { data: user } = await supabase.auth.getUser();
        if (user.user) {
          await supabase
            .from('client_workflow.clients')
            .insert({
              auth_user_id: userId,
              email: user.user.email,
              company_name: userMetadata?.companyName || 'My Company'
            });
        }
      }

      // Create account type record if missing
      await supabase
        .from('account_types')
        .upsert({
          auth_user_id: userId,
          account_type: 'client'
        });

      return { success: true, message: 'Account repaired successfully' };
    } catch (error) {
      console.error('Account repair error:', error);
      return { success: false, message: 'Failed to repair account' };
    }
  }

  static async checkRLSPolicies(userId: string): Promise<RLSTestResult> {
    try {
      console.log('Testing RLS policies for user:', userId);
      
      const testResults = [];

      // Test account_types table access
      try {
        const { data: accountTypeData, error: accountTypeError } = await supabase
          .from('account_types')
          .select('account_type')
          .eq('auth_user_id', userId);

        testResults.push({
          table_name: 'account_types',
          operation: 'SELECT',
          can_access: !accountTypeError,
          error_message: accountTypeError?.message
        });
      } catch (error) {
        testResults.push({
          table_name: 'account_types',
          operation: 'SELECT',
          can_access: false,
          error_message: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Test profiles table access (if it exists)
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', userId);

        testResults.push({
          table_name: 'profiles',
          operation: 'SELECT',
          can_access: !profileError,
          error_message: profileError?.message
        });
      } catch (error) {
        testResults.push({
          table_name: 'profiles',
          operation: 'SELECT',
          can_access: false,
          error_message: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      return {
        success: true,
        data: testResults
      };
    } catch (error) {
      console.error('RLS test error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async testSimplifiedTrigger(email: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log('Testing simplified trigger for email:', email);
      
      const { data: user } = await supabase.auth.getUser();
      
      if (!user.user) {
        return {
          success: false,
          error: 'No authenticated user'
        };
      }

      // Check if user has account type
      const { data: accountType } = await supabase
        .from('account_types')
        .select('account_type')
        .eq('auth_user_id', user.user.id)
        .single();

      // Check if user has profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('user_id', user.user.id)
        .single();

      return {
        success: true,
        data: {
          user_id: user.user.id,
          email: user.user.email,
          has_account_type: !!accountType,
          account_type: accountType?.account_type,
          has_company_profile: !!profile,
          company_name: profile?.full_name,
          trigger_working: !!accountType || !!profile
        }
      };
    } catch (error) {
      console.error('Simplified trigger test error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
