
import { supabase } from '@/lib/supabase';

interface SimpleDiagnostic {
  isClient: boolean;
  hasProfile: boolean;
  issues: string[];
}

interface AccountStatus {
  success: boolean;
  data?: {
    user_id: string;
    email: string;
    has_account_type: boolean;
    account_type: string | null;
    has_company_profile: boolean;
    is_client_account: boolean;
  };
  error?: string;
}

interface EnsureClientResult {
  success: boolean;
  data?: any;
  error?: string;
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

  static async isClientAccount(userId: string): Promise<boolean> {
    try {
      console.log(`Checking if user is client account: ${userId}`);
      
      const { data: accountType } = await supabase
        .from('account_types')
        .select('account_type')
        .eq('auth_user_id', userId)
        .single();

      const isClient = accountType?.account_type === 'client';
      console.log(`User ${userId} is client account: ${isClient}`);
      return isClient;
    } catch (error) {
      console.error('Error checking client account status:', error);
      return false;
    }
  }

  static async ensureClientRecord(userId: string, userEmail: string, userMetadata: any): Promise<EnsureClientResult> {
    try {
      console.log('Ensuring client record for user:', userId, userEmail);
      
      // First, ensure account type is set to client
      const { error: accountTypeError } = await supabase
        .from('account_types')
        .upsert({
          auth_user_id: userId,
          account_type: 'client'
        });

      if (accountTypeError) {
        console.error('Error setting account type:', accountTypeError);
        return {
          success: false,
          error: accountTypeError.message
        };
      }

      // Then, create a basic profile if needed
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!existingProfile) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: userId,
            email: userEmail,
            full_name: userMetadata.full_name || userMetadata.firstName + ' ' + userMetadata.lastName || null
          });

        if (profileError) {
          console.error('Error creating profile:', profileError);
          return {
            success: false,
            error: profileError.message
          };
        }
      }

      console.log('Client record ensured successfully');
      return {
        success: true,
        data: {
          account_type_set: true,
          profile_created: !existingProfile
        }
      };
    } catch (error) {
      console.error('Exception ensuring client record:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async checkUserAccountStatus(userId: string): Promise<AccountStatus> {
    try {
      console.log('Checking user account status:', userId);
      
      const { data: user } = await supabase.auth.getUser();
      
      if (!user.user || user.user.id !== userId) {
        return {
          success: false,
          error: 'User not authenticated or ID mismatch'
        };
      }

      // Check account type
      const { data: accountType } = await supabase
        .from('account_types')
        .select('account_type')
        .eq('auth_user_id', userId)
        .single();

      // Check if has profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      const isClient = accountType?.account_type === 'client';

      return {
        success: true,
        data: {
          user_id: userId,
          email: user.user.email || '',
          has_account_type: !!accountType,
          account_type: accountType?.account_type || null,
          has_company_profile: !!profile,
          is_client_account: isClient
        }
      };
    } catch (error) {
      console.error('Error checking user account status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async logDiagnosticEvent(event: string, data: any): Promise<void> {
    try {
      console.log(`Diagnostic event: ${event}`, data);
      
      // Log to error_logs table for tracking
      await supabase
        .from('error_logs')
        .insert({
          error_type: 'diagnostic_event',
          error_message: event,
          context: 'simplified_client_diagnostics',
          metadata: {
            event_data: data,
            timestamp: new Date().toISOString()
          }
        });
    } catch (error) {
      console.error('Failed to log diagnostic event:', error);
    }
  }
}
