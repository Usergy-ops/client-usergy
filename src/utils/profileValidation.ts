
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
    
    // Get client profile from client_workflow.clients table
    const { data: clientProfile, error } = await supabase
      .from('client_workflow.clients')
      .select(`
        email,
        full_name,
        first_name,
        last_name,
        company_name,
        company_website,
        industry,
        company_size,
        contact_role,
        contact_phone,
        company_country,
        company_city,
        company_timezone
      `)
      .eq('auth_user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching client profile:', error);
      return {
        isComplete: false,
        error: error.message
      };
    }

    if (!clientProfile) {
      return {
        isComplete: false,
        error: 'Client profile not found',
        missingFields: ['All profile fields']
      };
    }

    // Define required fields for a complete profile
    const requiredFields = {
      email: 'Email',
      company_name: 'Company Name',
      full_name: 'Full Name',
      industry: 'Industry',
      company_size: 'Company Size',
      contact_role: 'Contact Role',
      company_country: 'Company Country',
      company_city: 'Company City',
      company_timezone: 'Company Timezone'
    };

    const missingFields: string[] = [];
    let completedFields = 0;
    const totalFields = Object.keys(requiredFields).length;

    // Check each required field
    for (const [field, displayName] of Object.entries(requiredFields)) {
      const value = clientProfile[field as keyof typeof clientProfile];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        missingFields.push(displayName);
      } else {
        completedFields++;
      }
    }

    const completionPercentage = Math.round((completedFields / totalFields) * 100);
    const isComplete = missingFields.length === 0;

    console.log('Profile completion check result:', {
      isComplete,
      completionPercentage,
      missingFields
    });

    return {
      isComplete,
      completionPercentage,
      missingFields
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

    const { data, error } = await supabase
      .from('client_workflow.clients')
      .update({
        ...profileData,
        updated_at: new Date().toISOString()
      })
      .eq('auth_user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating client profile:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      data
    };

  } catch (error) {
    console.error('Exception updating client profile:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
