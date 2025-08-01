
import { supabase } from '@/integrations/supabase/client';

export class SimplifiedClientDiagnostics {
  /**
   * Check if a user is a client account
   */
  static async isClientAccount(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('account_types')
        .select('account_type')
        .eq('auth_user_id', userId)
        .single();

      if (error) {
        console.error('Error checking client account status:', error);
        return false;
      }

      return data?.account_type === 'client';
    } catch (error) {
      console.error('Exception checking client account status:', error);
      return false;
    }
  }

  /**
   * Ensure a client record exists
   */
  static async ensureClientRecord(userId: string, email: string, metadata: any = {}) {
    try {
      console.log('Ensuring client record for:', userId, email);

      // First, ensure account type is set to client
      const { error: accountTypeError } = await supabase
        .from('account_types')
        .upsert({
          auth_user_id: userId,
          account_type: 'client'
        }, {
          onConflict: 'auth_user_id'
        });

      if (accountTypeError) {
        console.error('Error setting account type:', accountTypeError);
        return { success: false, error: accountTypeError.message };
      }

      // Then, ensure client record exists in client_workflow schema
      const fullName = metadata.firstName && metadata.lastName 
        ? `${metadata.firstName} ${metadata.lastName}`.trim()
        : null;

      const { error: clientError } = await supabase
        .from('client_workflow.clients')
        .upsert({
          auth_user_id: userId,
          email,
          full_name: fullName,
          first_name: metadata.firstName || null,
          last_name: metadata.lastName || null,
          company_name: metadata.companyName || 'My Company'
        }, {
          onConflict: 'auth_user_id'
        });

      if (clientError) {
        console.error('Error creating client record:', clientError);
        return { success: false, error: clientError.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Exception ensuring client record:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get client profile information
   */
  static async getClientProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('client_workflow.clients')
        .select('*')
        .eq('auth_user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching client profile:', error);
        return { success: false, error: error.message, data: null };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Exception fetching client profile:', error);
      return { success: false, error: error.message, data: null };
    }
  }

  /**
   * Update client profile
   */
  static async updateClientProfile(userId: string, profileData: any) {
    try {
      const { data, error } = await supabase
        .from('client_workflow.clients')
        .update(profileData)
        .eq('auth_user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating client profile:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Exception updating client profile:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check profile completion status
   */
  static async checkProfileCompletion(userId: string) {
    try {
      const profile = await this.getClientProfile(userId);
      
      if (!profile.success || !profile.data) {
        return { success: false, isComplete: false, error: 'Profile not found' };
      }

      const requiredFields = [
        'email',
        'company_name',
        'full_name'
      ];

      const isComplete = requiredFields.every(field => 
        profile.data[field] && profile.data[field].trim() !== ''
      );

      return { success: true, isComplete };
    } catch (error) {
      console.error('Exception checking profile completion:', error);
      return { success: false, isComplete: false, error: error.message };
    }
  }
}
