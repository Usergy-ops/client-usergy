
import { supabase } from '@/lib/supabase';

export interface ProfileCompletionCheck {
  isComplete: boolean;
  missingFields?: string[];
  error?: string;
}

export async function checkProfileCompletion(userId: string): Promise<ProfileCompletionCheck> {
  try {
    console.log('Checking profile completion for user:', userId);
    
    // Call the database function to check profile completeness
    const { data, error } = await supabase.rpc('is_profile_complete', {
      user_id_param: userId
    });

    if (error) {
      console.error('Error checking profile completion:', error);
      return {
        isComplete: false,
        error: error.message
      };
    }

    console.log('Profile completion result:', data);
    
    return {
      isComplete: data === true
    };
  } catch (error) {
    console.error('Exception in profile completion check:', error);
    return {
      isComplete: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function getIncompleteProfileFields(userId: string): Promise<string[]> {
  try {
    // Get the current profile data to identify missing fields
    const { data: profile, error } = await supabase
      .from('client_workspace.company_profiles')
      .select('company_name, industry, company_size, contact_role, company_country, company_city, company_timezone, onboarding_status')
      .eq('auth_user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile data:', error);
      return [];
    }

    if (!profile) {
      return ['company_name', 'industry', 'company_size', 'contact_role', 'company_country', 'company_city', 'company_timezone'];
    }

    const missingFields: string[] = [];
    const requiredFields = [
      'company_name',
      'industry',
      'company_size', 
      'contact_role',
      'company_country',
      'company_city',
      'company_timezone'
    ];

    requiredFields.forEach(field => {
      const value = profile[field as keyof typeof profile];
      if (!value || value === '') {
        missingFields.push(field);
      }
    });

    if (profile.onboarding_status !== 'completed') {
      missingFields.push('onboarding_status');
    }

    return missingFields;
  } catch (error) {
    console.error('Exception getting incomplete profile fields:', error);
    return [];
  }
}
