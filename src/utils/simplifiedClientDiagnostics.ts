
import { supabase } from '@/lib/supabase';

interface SimpleDiagnostic {
  isClient: boolean;
  hasProfile: boolean;
  issues: string[];
}

export class SimplifiedClientDiagnostics {
  static async quickClientCheck(userId: string): Promise<SimpleDiagnostic> {
    try {
      // Check if user is a client
      const { data: accountType } = await supabase
        .from('account_types')
        .select('account_type')
        .eq('auth_user_id', userId)
        .single();

      const isClient = accountType?.account_type === 'client';

      // Check if they have a company profile
      const { data: profile } = await supabase
        .from('client_workspace.company_profiles')
        .select('id')
        .eq('auth_user_id', userId)
        .single();

      const hasProfile = !!profile;

      const issues: string[] = [];
      if (!isClient) issues.push('Not registered as client');
      if (!hasProfile) issues.push('No company profile');

      return { isClient, hasProfile, issues };
    } catch (error) {
      console.error('Quick diagnostic error:', error);
      return { isClient: false, hasProfile: false, issues: ['Diagnostic failed'] };
    }
  }
}
