
import { supabase } from '@/lib/supabase';

interface ClientStatus {
  hasClientRecord: boolean;
  clientRecord: any;
  isAuthenticated: boolean;
  sessionValid: boolean;
}

export class ClientWorkflowDiagnostics {
  static async checkClientStatus(userId: string): Promise<{
    success: boolean;
    data?: ClientStatus;
    error?: string;
  }> {
    try {
      console.log(`Checking client status for user: ${userId}`);
      
      // Check if user has client record
      const { data: clientRecord, error: clientError } = await supabase
        .from('client_workflow.clients')
        .select('*')
        .eq('auth_user_id', userId)
        .single();

      // Get current session info
      const { data: { session } } = await supabase.auth.getSession();
      
      const status: ClientStatus = {
        hasClientRecord: !clientError && !!clientRecord,
        clientRecord: clientRecord || null,
        isAuthenticated: !!session?.user && session.user.id === userId,
        sessionValid: !!session && (!session.expires_at || session.expires_at > Date.now() / 1000),
      };

      return {
        success: true,
        data: status
      };

    } catch (error) {
      console.error('Client status check error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
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

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking client record:', error);
        return false;
      }

      const isClient = !!clientRecord;
      console.log(`User ${userId} has client record: ${isClient}`);
      return isClient;

    } catch (error) {
      console.error('Exception checking client status:', error);
      return false;
    }
  }

  static async ensureClientRecord(userId: string, userEmail: string, additionalData: any = {}): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      console.log(`Ensuring client record for user: ${userId} (${userEmail})`);
      
      const clientData = {
        auth_user_id: userId,
        email: userEmail,
        full_name: additionalData.full_name || 
          (additionalData.firstName && additionalData.lastName ? 
            `${additionalData.firstName} ${additionalData.lastName}` : null),
        company_name: additionalData.companyName || additionalData.company_name || null
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
          error: insertError.message
        };
      }

      console.log('Client record created successfully:', newRecord);
      return {
        success: true,
        data: newRecord
      };

    } catch (error) {
      console.error('Exception ensuring client record:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
