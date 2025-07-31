
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ClientAccountCreationState {
  isCreating: boolean;
  isComplete: boolean;
  error: string | null;
}

interface CreateClientAccountResult {
  success: boolean;
  is_client_account?: boolean;
  error?: string;
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
      console.log('Creating client account for user:', userId, userMetadata);
      
      const { data: rawResult, error } = await supabase.rpc('ensure_client_account_robust', {
        user_id_param: userId,
        company_name_param: userMetadata?.companyName || userMetadata?.company_name || 'My Company',
        first_name_param: userMetadata?.contactFirstName || 
          userMetadata?.first_name ||
          userMetadata?.full_name?.split(' ')[0] || 'User',
        last_name_param: userMetadata?.contactLastName || 
          userMetadata?.last_name ||
          userMetadata?.full_name?.split(' ').slice(1).join(' ') || ''
      });

      if (error) {
        console.error('RPC call failed:', error);
        throw error;
      }

      console.log('Account creation result:', rawResult);

      // Type guard to ensure we have the right structure
      const result = rawResult as unknown as CreateClientAccountResult;
      if (result && typeof result === 'object' && 'success' in result) {
        if (result.success && result.is_client_account) {
          console.log('Client account created successfully');
          setState(prev => ({ ...prev, isCreating: false, isComplete: true }));
          return { success: true, result };
        } else {
          const errorMessage = result.error || 'Account creation failed';
          console.error('Account creation failed:', errorMessage);
          throw new Error(errorMessage);
        }
      } else {
        throw new Error('Invalid response format from account creation');
      }
    } catch (error) {
      console.error('Client account creation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Account creation failed';
      setState(prev => ({ 
        ...prev, 
        isCreating: false, 
        error: errorMessage
      }));
      return { success: false, error: errorMessage };
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
