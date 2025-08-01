
import { supabase } from '@/lib/supabase';

interface UnifiedAccountStatus {
  success: boolean;
  data?: {
    user_id: string;
    email: string;
    account_type: string | null;
    has_client_record: boolean;
    is_authenticated: boolean;
    email_confirmed: boolean;
  };
  error?: string;
}

export class UnifiedClientDiagnostics {
  static async checkAccountStatus(userId: string): Promise<UnifiedAccountStatus> {
    try {
      console.log('Checking unified account status for user:', userId);
      
      // Get current user session
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || user.id !== userId) {
        return {
          success: false,
          error: 'User not authenticated or ID mismatch'
        };
      }

      // Check account type using the consolidated account_types table
      const { data: accountType, error: accountError } = await supabase
        .from('account_types')
        .select('account_type')
        .eq('auth_user_id', userId)
        .single();

      // Check for client record in client_workflow.clients
      const { data: clientRecord, error: clientError } = await supabase
        .from('client_workflow.clients')
        .select('id')
        .eq('auth_user_id', userId)
        .single();

      return {
        success: true,
        data: {
          user_id: userId,
          email: user.email || '',
          account_type: accountType?.account_type || null,
          has_client_record: !clientError && !!clientRecord,
          is_authenticated: !!user,
          email_confirmed: !!user.email_confirmed_at
        }
      };
    } catch (error) {
      console.error('Error checking unified account status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async isClientAccount(userId: string): Promise<boolean> {
    try {
      console.log('Checking if user is client account:', userId);
      
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

  static async logDiagnosticEvent(event: string, data: any): Promise<void> {
    try {
      console.log(`Unified diagnostic event: ${event}`, data);
      
      // Log to error_logs table for tracking
      await supabase
        .from('error_logs')
        .insert({
          error_type: 'unified_diagnostic_event',
          error_message: event,
          context: 'unified_client_diagnostics',
          metadata: {
            event_data: data,
            timestamp: new Date().toISOString()
          }
        });
    } catch (error) {
      console.error('Failed to log unified diagnostic event:', error);
    }
  }

  static async testUnifiedTrigger(userEmail: string): Promise<any> {
    try {
      console.log('Testing unified trigger for email:', userEmail);
      
      // This would test if the trigger is working correctly
      // by checking if the account type assignment is working
      const { data: user } = await supabase.auth.getUser();
      
      if (!user.user || user.user.email !== userEmail) {
        return {
          success: false,
          error: 'User not found or email mismatch'
        };
      }

      const status = await this.checkAccountStatus(user.user.id);
      
      return {
        success: true,
        data: {
          user_id: user.user.id,
          email: user.user.email,
          account_status: status.data,
          trigger_working: status.success && !!status.data?.account_type
        }
      };
    } catch (error) {
      console.error('Error testing unified trigger:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
