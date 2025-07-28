
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface ClientAccountCreationState {
  isCreating: boolean;
  isComplete: boolean;
  error: string | null;
}

export function useClientAccountCreation() {
  const [state, setState] = useState<ClientAccountCreationState>({
    isCreating: false,
    isComplete: false,
    error: null,
  });

  const createClientAccount = useCallback(async (userId: string, userMetadata: any) => {
    setState(prev => ({ ...prev, isCreating: true, error: null }));

    try {
      console.log('Creating client account for user:', userId);
      
      // Use the new safe account creation function
      const { data: createResult, error: createError } = await supabase.rpc('create_client_account_safe', {
        user_id_param: userId,
        company_name_param: userMetadata?.companyName || 'My Company',
        first_name_param: userMetadata?.contactFirstName || 
          userMetadata?.full_name?.split(' ')[0] || '',
        last_name_param: userMetadata?.contactLastName || 
          userMetadata?.full_name?.split(' ').slice(1).join(' ') || ''
      });

      if (createError) {
        throw createError;
      }

      if (createResult?.success) {
        console.log('Client account created successfully');
        setState(prev => ({ ...prev, isCreating: false, isComplete: true }));
        return { success: true };
      } else {
        throw new Error(createResult?.error || 'Account creation failed');
      }
    } catch (error) {
      console.error('Client account creation failed:', error);
      setState(prev => ({ 
        ...prev, 
        isCreating: false, 
        error: error instanceof Error ? error.message : 'Account creation failed' 
      }));
      return { success: false, error };
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      isCreating: false,
      isComplete: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    createClientAccount,
    reset,
  };
}
