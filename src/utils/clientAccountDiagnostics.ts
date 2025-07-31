
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
}
