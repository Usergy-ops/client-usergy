
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
      
      // Check if user exists in client_workflow.clients
      const { data: clientRecord, error: clientError } = await supabase
        .from('client_workflow.clients')
        .select('*')
        .eq('auth_user_id', userId)
        .single();

      if (clientError && clientError.code !== 'PGRST116') {
        console.error('Error checking client record:', clientError);
        return {
          success: false,
          error: clientError.message,
          timestamp,
          source: 'client_record_check'
        };
      }

      // Get current session info
      const { data: { session } } = await supabase.auth.getSession();
      
      const status: UserAccountStatus = {
        userExists: !!session?.user,
        hasClientRecord: !!clientRecord,
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
      
      const { data: clientRecord, error } = await supabase
        .from('client_workflow.clients')
        .select('id')
        .eq('auth_user_id', userId)
        .single();

      if (error) {
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
      
      // Check if client record already exists
      const { data: existingRecord } = await supabase
        .from('client_workflow.clients')
        .select('*')
        .eq('auth_user_id', userId)
        .single();

      if (existingRecord) {
        console.log(`Client record already exists:`, existingRecord);
        return {
          success: true,
          data: { 
            client_record: existingRecord,
            action: 'already_exists'
          },
          timestamp,
          source: 'client_record_exists'
        };
      }

      // Create new client record
      const clientData = {
        auth_user_id: userId,
        email: userEmail,
        full_name: additionalData.full_name || additionalData.firstName && additionalData.lastName ? 
          `${additionalData.firstName} ${additionalData.lastName}` : null,
        company_name: additionalData.companyName || additionalData.company_name || null,
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
        console.error('Error creating client record:', insertError);
        return {
          success: false,
          error: insertError.message,
          timestamp,
          source: 'client_record_creation_failed'
        };
      }

      console.log('Client record created successfully:', newRecord);
      return {
        success: true,
        data: {
          client_record: newRecord,
          action: 'created'
        },
        timestamp,
        source: 'client_record_created'
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
