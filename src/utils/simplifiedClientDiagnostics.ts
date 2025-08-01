
import { supabase } from '@/integrations/supabase/client';

export class SimplifiedClientDiagnostics {
  /**
   * Check if a user is a client account
   */
  static async isClientAccount(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('is_client_account', { user_id_param: userId });

      if (error) {
        console.error('Error checking client account status:', error);
        return false;
      }

      return data || false;
    } catch (error) {
      console.error('Exception checking client account status:', error);
      return false;
    }
  }

  /**
   * Ensure a client record exists using RPC function
   */
  static async ensureClientRecord(userId: string, email: string, metadata: any = {}) {
    try {
      console.log('Ensuring client record for:', userId, email);

      const { data, error } = await supabase
        .rpc('ensure_client_account', {
          user_id_param: userId,
          company_name_param: metadata.companyName || 'My Company',
          first_name_param: metadata.firstName || '',
          last_name_param: metadata.lastName || ''
        });

      if (error) {
        console.error('Error creating client record:', error);
        return { success: false, error: error.message };
      }

      return { 
        success: data?.success || true,
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

  /**
   * Get client profile information using account status
   */
  static async getClientProfile(userId: string) {
    try {
      const { data: debugInfo, error } = await supabase
        .rpc('get_user_debug_info', { user_id_param: userId });

      if (error) {
        console.error('Error fetching client profile:', error);
        return { success: false, error: error.message, data: null };
      }

      return { success: true, data: debugInfo };
    } catch (error) {
      console.error('Exception fetching client profile:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error', data: null };
    }
  }

  /**
   * Update client profile using RPC function
   */
  static async updateClientProfile(userId: string, profileData: any) {
    try {
      const { data, error } = await supabase
        .rpc('save_complete_client_profile', {
          user_id_param: userId,
          company_name_param: profileData.company_name || 'My Company',
          full_name_param: profileData.full_name || ''
        });

      if (error) {
        console.error('Error updating client profile:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Exception updating client profile:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check profile completion status
   */
  static async checkProfileCompletion(userId: string) {
    try {
      const { data: isComplete, error } = await supabase
        .rpc('is_profile_complete', { user_id_param: userId });

      if (error) {
        console.error('Error checking profile completion:', error);
        return { success: false, isComplete: false, error: error.message };
      }

      return { success: true, isComplete: isComplete || false };
    } catch (error) {
      console.error('Exception checking profile completion:', error);
      return { 
        success: false, 
        isComplete: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check user account status
   */
  static async checkUserAccountStatus(userId: string) {
    try {
      const { data: debugInfo, error } = await supabase
        .rpc('get_user_debug_info', { user_id_param: userId });

      if (error) {
        console.error('Error checking user account status:', error);
        return { success: false, error: error.message, data: null };
      }

      return { 
        success: true, 
        data: {
          isClient: debugInfo?.account_type_info?.account_type === 'client',
          accountType: debugInfo?.account_type_info?.account_type,
          debugInfo
        }
      };
    } catch (error) {
      console.error('Exception checking user account status:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        data: null
      };
    }
  }

  /**
   * Log diagnostic event
   */
  static async logDiagnosticEvent(event: string, data: any) {
    try {
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
