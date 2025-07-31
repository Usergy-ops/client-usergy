
import { supabase } from '@/lib/supabase';

interface SimplifiedDiagnosticResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
  source: string;
}

interface UserAccountStatus {
  userExists: boolean;
  hasAccountType: boolean;
  accountType: string | null;
  isAuthenticated: boolean;
  sessionValid: boolean;
  issues: string[];
  recommendations: string[];
}

export class SimplifiedClientDiagnostics {
  static async checkUserAccountStatus(userId: string): Promise<SimplifiedDiagnosticResult> {
    const timestamp = new Date().toISOString();
    
    try {
      console.log(`Checking simplified user account status for: ${userId}`);
      
      // Check if user exists and get their account type
      const { data: accountType, error: accountError } = await supabase
        .from('account_types')
        .select('account_type')
        .eq('auth_user_id', userId)
        .single();

      if (accountError && accountError.code !== 'PGRST116') {
        console.error('Error checking account type:', accountError);
        return {
          success: false,
          error: accountError.message,
          timestamp,
          source: 'account_type_check'
        };
      }

      // Get current session info
      const { data: { session } } = await supabase.auth.getSession();
      
      const status: UserAccountStatus = {
        userExists: !!session?.user,
        hasAccountType: !!accountType,
        accountType: accountType?.account_type || null,
        isAuthenticated: !!session?.user && session.user.id === userId,
        sessionValid: !!session && (!session.expires_at || session.expires_at > Date.now() / 1000),
        issues: [],
        recommendations: []
      };

      // Analyze issues
      if (!status.userExists) {
        status.issues.push('User not found in authentication system');
        status.recommendations.push('User needs to sign up or sign in');
      }

      if (!status.hasAccountType) {
        status.issues.push('User lacks account type assignment');
        status.recommendations.push('Account type will be assigned automatically');
      }

      if (status.accountType !== 'client') {
        status.issues.push(`Account type is '${status.accountType}', expected 'client'`);
        status.recommendations.push('Account type assignment may need correction');
      }

      if (!status.sessionValid) {
        status.issues.push('Session is invalid or expired');
        status.recommendations.push('User needs to refresh session or re-authenticate');
      }

      return {
        success: true,
        data: status,
        timestamp,
        source: 'simplified_status_check'
      };

    } catch (error) {
      console.error('Simplified diagnostic exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown diagnostic error',
        timestamp,
        source: 'exception'
      };
    }
  }

  static async isClientAccount(userId: string): Promise<boolean> {
    try {
      console.log(`Checking if user is client account: ${userId}`);
      
      const { data: accountType, error } = await supabase
        .from('account_types')
        .select('account_type')
        .eq('auth_user_id', userId)
        .single();

      if (error) {
        console.error('Error checking client account status:', error);
        return false;
      }

      const isClient = accountType?.account_type === 'client';
      console.log(`User ${userId} is client account: ${isClient}`);
      return isClient;

    } catch (error) {
      console.error('Exception checking client account status:', error);
      return false;
    }
  }

  static async ensureAccountType(userId: string, userEmail: string): Promise<SimplifiedDiagnosticResult> {
    const timestamp = new Date().toISOString();
    
    try {
      console.log(`Ensuring account type for user: ${userId} (${userEmail})`);
      
      // Check if account type already exists
      const { data: existingType } = await supabase
        .from('account_types')
        .select('account_type')
        .eq('auth_user_id', userId)
        .single();

      if (existingType) {
        console.log(`Account type already exists: ${existingType.account_type}`);
        return {
          success: true,
          data: { 
            account_type: existingType.account_type,
            action: 'already_exists'
          },
          timestamp,
          source: 'account_type_exists'
        };
      }

      // Use the existing assign_account_type_by_domain function
      const result = await supabase.rpc('assign_account_type_by_domain', {
        user_id_param: userId,
        user_email: userEmail
      });

      if (result.error) {
        console.error('Error assigning account type:', result.error);
        return {
          success: false,
          error: result.error.message,
          timestamp,
          source: 'account_type_assignment_failed'
        };
      }

      console.log('Account type assigned successfully:', result.data);
      return {
        success: true,
        data: result.data,
        timestamp,
        source: 'account_type_assigned'
      };

    } catch (error) {
      console.error('Exception ensuring account type:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp,
        source: 'ensure_account_type_exception'
      };
    }
  }

  static async logDiagnosticEvent(event: string, data: any) {
    try {
      await supabase.from('error_logs').insert({
        error_type: 'diagnostic_event',
        error_message: event,
        context: 'simplified_client_diagnostics',
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
