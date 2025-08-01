
import { useState, useCallback } from 'react';
import { SimplifiedClientDiagnostics } from '@/utils/simplifiedClientDiagnostics';
import { useErrorLogger } from './useErrorLogger';

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

  const { logAuthError } = useErrorLogger();

  const createClientAccount = useCallback(async (userId: string, userMetadata: any): Promise<CreateClientAccountResult> => {
    setState(prev => ({ ...prev, isCreating: true, error: null }));

    try {
      console.log('Creating client account for user:', userId, userMetadata);
      
      // Use simplified client record creation
      const result = await SimplifiedClientDiagnostics.ensureClientRecord(userId, userMetadata.email, userMetadata);

      if (result.success) {
        // Verify client status
        const isClient = await SimplifiedClientDiagnostics.isClientAccount(userId);
        
        if (isClient) {
          console.log('Client account created successfully');
          setState(prev => ({ ...prev, isCreating: false, isComplete: true }));
          return { success: true, is_client_account: true };
        } else {
          throw new Error('Client account created but verification failed');
        }
      } else {
        throw new Error(result.error || 'Client account creation failed');
      }
    } catch (error) {
      console.error('Client account creation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Account creation failed';
      
      await logAuthError(error, 'client_account_creation');
      
      setState(prev => ({ 
        ...prev, 
        isCreating: false, 
        error: errorMessage
      }));
      return { success: false, error: errorMessage };
    }
  }, [logAuthError]);

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
