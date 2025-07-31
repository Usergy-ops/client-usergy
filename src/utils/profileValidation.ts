
import { supabase } from '@/integrations/supabase/client';

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
    // Use is_client_account function to check if client exists, since we can't query the table directly
    const { data: isClient, error: clientError } = await supabase.rpc('is_client_account', {
      user_id_param: userId
    });

    if (clientError) {
      console.error('Error checking client account:', clientError);
      return [];
    }

    if (!isClient) {
      return ['email', 'company_name'];
    }

    // Check profile completion to determine missing fields
    const completionCheck = await checkProfileCompletion(userId);
    
    if (!completionCheck.isComplete) {
      // Return the basic required fields that might be missing
      return ['company_name', 'email'];
    }

    return [];
  } catch (error) {
    console.error('Exception getting incomplete profile fields:', error);
    return [];
  }
}
