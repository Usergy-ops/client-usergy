
import { supabase } from '@/integrations/supabase/client';

interface ServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

interface ClientAccountStatus {
  isClient: boolean;
  hasClientRecord: boolean;
  accountType: string | null;
  email: string | null;
  userId: string;
  isProfileComplete?: boolean;
}

export class UnifiedClientService {
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
   * Ensure client account exists with comprehensive error handling
   */
  static async ensureClientAccount(
    userId: string, 
    email: string, 
    metadata: any = {}
  ): Promise<ServiceResult> {
    try {
      console.log('Ensuring client account for:', userId, email);

      const { data, error } = await supabase
        .rpc('ensure_client_account', {
          user_id_param: userId,
          company_name_param: metadata.companyName || 'My Company',
          first_name_param: metadata.firstName || metadata.fullName?.split(' ')[0] || '',
          last_name_param: metadata.lastName || metadata.fullName?.split(' ').slice(1).join(' ') || ''
        });

      if (error) {
        console.error('Error creating client account:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Exception ensuring client account:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get comprehensive account status with profile completion check
   */
  static async getAccountStatus(userId: string): Promise<ServiceResult<ClientAccountStatus>> {
    try {
      const { data: user } = await supabase.auth.getUser();
      
      if (!user.user || user.user.id !== userId) {
        return { success: false, error: 'User not authenticated' };
      }

      // Check if user is a client
      const isClient = await this.isClientAccount(userId);

      // Get account type information
      const { data: accountType } = await supabase
        .from('account_types')
        .select('account_type')
        .eq('auth_user_id', userId)
        .single();

      // Check profile completion
      const profileResult = await this.checkProfileCompletion(userId);
      const isProfileComplete = profileResult.success ? profileResult.data?.isComplete : false;

      return {
        success: true,
        data: {
          isClient,
          hasClientRecord: isClient,
          accountType: accountType?.account_type || null,
          email: user.user.email || null,
          userId,
          isProfileComplete
        }
      };
    } catch (error) {
      console.error('Error getting account status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update client profile with validation
   */
  static async updateProfile(userId: string, profileData: any): Promise<ServiceResult> {
    try {
      console.log('Updating client profile for user:', userId, profileData);

      const { data, error } = await supabase
        .rpc('save_complete_client_profile', {
          user_id_param: userId,
          company_name_param: profileData.company_name || profileData.companyName || 'My Company',
          full_name_param: profileData.full_name || profileData.fullName || '',
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
  static async checkProfileCompletion(userId: string): Promise<ServiceResult<{ isComplete: boolean }>> {
    try {
      const { data, error } = await supabase
        .rpc('is_profile_complete', { user_id_param: userId });

      if (error) {
        console.error('Error checking profile completion:', error);
        return { success: false, error: error.message };
      }

      return { 
        success: true, 
        data: { isComplete: data || false }
      };
    } catch (error) {
      console.error('Exception checking profile completion:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get client profile information
   */
  static async getClientProfile(userId: string): Promise<ServiceResult> {
    try {
      const { data: debugInfo, error } = await supabase
        .rpc('get_user_debug_info', { user_id_param: userId });

      if (error) {
        console.error('Error fetching client profile:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: debugInfo };
    } catch (error) {
      console.error('Exception fetching client profile:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Repair client account if issues are detected
   */
  static async repairClientAccount(userId: string, userMetadata?: any): Promise<ServiceResult> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user || user.user.id !== userId) {
        return { success: false, error: 'User not authenticated' };
      }

      // Use ensure client account to repair
      const result = await this.ensureClientAccount(userId, user.user.email!, userMetadata);
      
      if (result.success) {
        return { success: true, data: 'Account repaired successfully' };
      }

      return result;
    } catch (error) {
      console.error('Account repair error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to repair account'
      };
    }
  }
}
