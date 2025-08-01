
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SimplifiedClientDiagnostics } from '@/utils/simplifiedClientDiagnostics';

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
      
      // Get user info
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || user.id !== userId) {
        throw new Error('User not found or authentication mismatch');
      }

      // Use simplified client record creation
      const result = await SimplifiedClientDiagnostics.ensureClientRecord(userId, user.email!, userMetadata);

      if (result.success) {
        // Wait a moment and verify client status
        await new Promise(resolve => setTimeout(resolve, 1000));
        const isClient = await SimplifiedClientDiagnostics.isClientAccount(userId);
        
        if (isClient) {
          console.log('Client record created successfully');
          setState(prev => ({ ...prev, isCreating: false, isComplete: true }));
          return { success: true, result: { is_client_account: true } };
        } else {
          throw new Error('Client record created but verification failed');
        }
      } else {
        throw new Error(result.error || 'Client record creation failed');
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
