
import { supabase } from '@/integrations/supabase/client';

interface ProfileCompletionResult {
  isComplete: boolean;
  error?: string;
  completionPercentage?: number;
  missingFields?: string[];
}

export async function checkProfileCompletion(userId: string): Promise<ProfileCompletionResult> {
  try {
    console.log('Checking profile completion for user:', userId);
    
    // Use RPC function to check if profile is complete
    const { data: isComplete, error } = await supabase
      .rpc('is_profile_complete', { user_id_param: userId });

    if (error) {
      console.error('Error checking profile completion:', error);
      return {
        isComplete: false,
        error: error.message
      };
    }

    // Get basic completion info (simplified)
    return {
      isComplete: isComplete || false,
      completionPercentage: isComplete ? 100 : 0,
      missingFields: isComplete ? [] : ['Profile information incomplete']
    };

  } catch (error) {
    console.error('Exception in profile completion check:', error);
    return {
      isComplete: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      missingFields: ['Unable to check profile']
    };
  }
}

export async function updateClientProfile(userId: string, profileData: any) {
  try {
    console.log('Updating client profile for user:', userId, profileData);

    // Use RPC function to save complete client profile
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
      console.error('Error updating client profile:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: data?.success || true,
      data: data
    };

  } catch (error) {
    console.error('Exception updating client profile:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
