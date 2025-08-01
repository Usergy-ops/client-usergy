
import { supabase } from '@/integrations/supabase/client';

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
      
      // Use RPC function to check if user is a client
      const { data: isClient, error: clientError } = await supabase
        .rpc('is_client_account', { user_id_param: userId });

      // Get current session info
      const { data: { session } } = await supabase.auth.getSession();
      
      const status: ClientStatus = {
        hasClientRecord: !clientError && !!isClient,
        clientRecord: isClient ? { isClient: true } : null,
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
      
      const { data: isClient, error } = await supabase
        .rpc('is_client_account', { user_id_param: userId });

      if (error) {
        console.error('Error checking client record:', error);
        return false;
      }

      console.log(`User ${userId} has client record: ${isClient}`);
      return isClient || false;

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
      
      const { data, error } = await supabase
        .rpc('ensure_client_account', {
          user_id_param: userId,
          company_name_param: additionalData.companyName || additionalData.company_name || 'My Company',
          first_name_param: additionalData.firstName || '',
          last_name_param: additionalData.lastName || ''
        });

      if (error) {
        console.error('Error creating client record:', error);
        return {
          success: false,
          error: error.message
        };
      }

      console.log('Client record created successfully:', data);
      return {
        success: true,
        data: data
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
