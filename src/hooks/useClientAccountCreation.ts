
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
      
      // Use the updated ensure_client_account_robust function
      const { data: result, error } = await supabase.rpc('ensure_client_account_robust', {
        user_id_param: userId,
        company_name_param: userMetadata?.companyName || userMetadata?.company_name || 'My Company',
        first_name_param: userMetadata?.contactFirstName || 
          userMetadata?.first_name ||
          userMetadata?.full_name?.split(' ')[0] || '',
        last_name_param: userMetadata?.contactLastName || 
          userMetadata?.last_name ||
          userMetadata?.full_name?.split(' ').slice(1).join(' ') || ''
      });

      if (error) {
        throw error;
      }

      if (result?.success && result?.is_client_account) {
        console.log('Client account created successfully');
        setState(prev => ({ ...prev, isCreating: false, isComplete: true }));
        return { success: true };
      } else {
        throw new Error(result?.error || 'Account creation failed');
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
