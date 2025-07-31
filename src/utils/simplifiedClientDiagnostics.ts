
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
  hasClientRecord: boolean;
  clientRecord: any;
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
      
      // Use RPC call to check if user is a client account
      const { data: isClient, error: rpcError } = await supabase
        .rpc('is_client_account', { user_id_param: userId });

      if (rpcError) {
        console.error('RPC error checking client account:', rpcError);
      }

      // Also try direct query as fallback
      const { data: clientRecord, error: clientError } = await supabase
        .from('client_workflow.clients')
        .select('*')
        .eq('auth_user_id', userId)
        .single();

      // Get current session info
      const { data: { session } } = await supabase.auth.getSession();
      
      const status: UserAccountStatus = {
        userExists: !!session?.user,
        hasClientRecord: !clientError && !!clientRecord,
        clientRecord: clientRecord || null,
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

      if (!status.hasClientRecord) {
        status.issues.push('User lacks client record in client_workflow schema');
        status.recommendations.push('Client record will be created automatically');
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
      console.log(`Checking if user has client record: ${userId}`);
      
      // First try RPC call
      const { data: rpcResult, error: rpcError } = await supabase
        .rpc('is_client_account', { user_id_param: userId });

      if (!rpcError && typeof rpcResult === 'boolean') {
        console.log(`RPC result for user ${userId}: ${rpcResult}`);
        return rpcResult;
      }

      // Fallback to direct query if RPC fails
      const { data: clientRecord, error } = await supabase
        .from('client_workflow.clients')
        .select('id')
        .eq('auth_user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking client record status:', error);
        return false;
      }

      const isClient = !!clientRecord;
      console.log(`User ${userId} has client record: ${isClient}`);
      return isClient;

    } catch (error) {
      console.error('Exception checking client record status:', error);
      return false;
    }
  }

  static async ensureClientRecord(userId: string, userEmail: string, additionalData: any = {}): Promise<SimplifiedDiagnosticResult> {
    const timestamp = new Date().toISOString();
    
    try {
      console.log(`Ensuring client record for user: ${userId} (${userEmail})`);
      
      // Use the database function to ensure client record
      const { data: functionResult, error: functionError } = await supabase
        .rpc('ensure_client_account_robust', {
          user_id_param: userId,
          company_name_param: additionalData.companyName || additionalData.company_name || 'My Company',
          first_name_param: additionalData.contactFirstName || additionalData.first_name || additionalData.firstName || '',
          last_name_param: additionalData.contactLastName || additionalData.last_name || additionalData.lastName || ''
        });

      if (functionError) {
        console.error('Function error ensuring client record:', functionError);
        return {
          success: false,
          error: functionError.message,
          timestamp,
          source: 'function_error'
        };
      }

      if (functionResult && functionResult.success) {
        console.log('Client record ensured successfully via function:', functionResult);
        return {
          success: true,
          data: {
            client_record: functionResult,
            action: 'function_ensured'
          },
          timestamp,
          source: 'function_success'
        };
      }

      // If function didn't work, try direct insert as fallback
      const clientData = {
        auth_user_id: userId,
        email: userEmail,
        full_name: additionalData.full_name || additionalData.firstName && additionalData.lastName ? 
          `${additionalData.firstName} ${additionalData.lastName}` : null,
        company_name: additionalData.companyName || additionalData.company_name || 'My Company',
        company_url: additionalData.company_url || null,
        role: additionalData.role || null,
        country: additionalData.country || null
      };

      const { data: newRecord, error: insertError } = await supabase
        .from('client_workflow.clients')
        .insert(clientData)
        .select()
        .single();

      if (insertError) {
        console.error('Error creating client record via direct insert:', insertError);
        return {
          success: false,
          error: insertError.message,
          timestamp,
          source: 'direct_insert_failed'
        };
      }

      console.log('Client record created successfully via direct insert:', newRecord);
      return {
        success: true,
        data: {
          client_record: newRecord,
          action: 'direct_created'
        },
        timestamp,
        source: 'direct_insert_success'
      };

    } catch (error) {
      console.error('Exception ensuring client record:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp,
        source: 'ensure_client_record_exception'
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
