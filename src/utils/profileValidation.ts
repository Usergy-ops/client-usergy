
import { ClientAccountService } from '@/services/ClientAccountService';

interface ProfileCompletionResult {
  isComplete: boolean;
  error?: string;
  completionPercentage?: number;
  missingFields?: string[];
}

export async function checkProfileCompletion(userId: string): Promise<ProfileCompletionResult> {
  try {
    console.log('Checking profile completion for user:', userId);
    
    const result = await ClientAccountService.checkProfileCompletion(userId);
    
    if (!result.success) {
      return {
        isComplete: false,
        error: result.error,
        missingFields: ['Profile information incomplete']
      };
    }

    return {
      isComplete: result.data?.isComplete || false,
      completionPercentage: result.data?.isComplete ? 100 : 0,
      missingFields: result.data?.isComplete ? [] : ['Profile information incomplete']
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

    const result = await ClientAccountService.updateProfile(userId, profileData);
    
    return {
      success: result.success,
      error: result.error,
      data: result.data
    };

  } catch (error) {
    console.error('Exception updating client profile:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
