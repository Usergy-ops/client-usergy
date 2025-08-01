
import { supabase } from '@/integrations/supabase/client';

interface ClientAccountStatus {
  isClient: boolean;
  hasClientRecord: boolean;
  accountType: string | null;
  email: string | null;
  userId: string;
}

interface ServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export class ClientAccountService {
  /**
   * Check if user is a client account using RPC function
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
   * Ensure client account exists
   */
  static async ensureClientAccount(
    userId: string, 
    email: string, 
    metadata: any = {}
  ): Promise<ServiceResult> {
    try {
      const { data, error } = await supabase
        .rpc('ensure_client_account', {
          user_id_param: userId,
          company_name_param: metadata.companyName || 'My Company',
          first_name_param: metadata.firstName || '',
          last_name_param: metadata.lastName || ''
        });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get comprehensive account status
   */
  static async getAccountStatus(userId: string): Promise<ServiceResult<ClientAccountStatus>> {
    try {
      const { data: user } = await supabase.auth.getUser();
      
      if (!user.user || user.user.id !== userId) {
        return { success: false, error: 'User not authenticated' };
      }

      const { data: accountType } = await supabase
        .from('account_types')
        .select('account_type')
        .eq('auth_user_id', userId)
        .single();

      const isClient = await this.isClientAccount(userId);

      return {
        success: true,
        data: {
          isClient,
          hasClientRecord: isClient,
          accountType: accountType?.account_type || null,
          email: user.user.email || null,
          userId
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update client profile
   */
  static async updateProfile(userId: string, profileData: any): Promise<ServiceResult> {
    try {
      const { data, error } = await supabase
        .rpc('save_complete_client_profile', {
          user_id_param: userId,
          company_name_param: profileData.company_name || 'My Company',
          full_name_param: profileData.full_name || '',
          company_website_param: profileData.company_website,
          industry_param: profileData.industry,
          company_size_param: profileData.company_size,
          contact_role_param: profileData.contact_role,
          contact_phone_param: profileData.contact_phone,
          company_country_param: profileData.company_country,
          company_city_param: profileData.company_city,
          company_timezone_param: profileData.company_timezone
        });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check profile completion
   */
  static async checkProfileCompletion(userId: string): Promise<ServiceResult<{ isComplete: boolean }>> {
    try {
      const { data, error } = await supabase
        .rpc('is_profile_complete', { user_id_param: userId });

      if (error) {
        return { success: false, error: error.message };
      }

      return { 
        success: true, 
        data: { isComplete: data || false }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
