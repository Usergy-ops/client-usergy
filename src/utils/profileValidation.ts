
import { supabase } from '@/lib/supabase';

export interface ProfileCompletionCheck {
  isComplete: boolean;
  missingFields?: string[];
  error?: string;
}

export async function checkProfileCompletion(userId: string): Promise<ProfileCompletionCheck> {
  try {
    console.log('Checking profile completion for user:', userId);
    
    // Call the updated database function to check if basic client record exists
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
    // Get the current client data to identify missing fields
    const { data: client, error } = await supabase
      .from('client_workflow.clients')
      .select('email, company_name, full_name')
      .eq('auth_user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching client data:', error);
      return [];
    }

    if (!client) {
      return ['email', 'company_name'];
    }

    const missingFields: string[] = [];
    const requiredFields = ['email', 'company_name'];

    requiredFields.forEach(field => {
      const value = client[field as keyof typeof client];
      if (!value || value === '') {
        missingFields.push(field);
      }
    });

    return missingFields;
  } catch (error) {
    console.error('Exception getting incomplete profile fields:', error);
    return [];
  }
}
