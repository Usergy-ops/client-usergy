
import { supabase } from '@/integrations/supabase/client';

export interface ProfileCompletionCheck {
  isComplete: boolean;
  missingFields?: string[];
  error?: string;
}

export async function checkProfileCompletion(userId: string): Promise<ProfileCompletionCheck> {
  try {
    console.log('Checking profile completion for user:', userId);
    
    // Call the profile completion function with correct parameter name
    const { data, error } = await supabase.rpc('calculate_profile_completion', {
      user_uuid: userId
    });

    if (error) {
      console.error('Error checking profile completion:', error);
      return {
        isComplete: false,
        error: error.message
      };
    }

    console.log('Profile completion result:', data);
    
    // Handle the numeric return value from the function
    const completionPercentage = typeof data === 'number' ? data : 0;
    
    return {
      isComplete: completionPercentage >= 80 // Consider 80% or higher as complete
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
    // Check if user has a client account type directly from database
    const { data: accountType, error: accountError } = await supabase
      .from('account_types')
      .select('account_type')
      .eq('auth_user_id', userId)
      .single();

    if (accountError || !accountType) {
      console.error('Error checking account type:', accountError);
      return ['email', 'company_name'];
    }

    const isClient = accountType.account_type === 'client';

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
