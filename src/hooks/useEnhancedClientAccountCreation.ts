
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useErrorLogger } from './useErrorLogger';
import { SimplifiedClientDiagnostics } from '@/utils/simplifiedClientDiagnostics';

interface EnhancedClientAccountCreationState {
  isCreating: boolean;
  isComplete: boolean;
  error: string | null;
  diagnostic?: any;
  canRetry?: boolean;
}

interface CreateClientAccountResult {
  success: boolean;
  userId?: string;
  message?: string;
  emailSent?: boolean;
  diagnostic?: any;
  can_retry?: boolean;
  error?: string;
}

export function useEnhancedClientAccountCreation() {
  const [state, setState] = useState<EnhancedClientAccountCreationState>({
    isCreating: false,
    isComplete: false,
    error: null,
    diagnostic: null,
    canRetry: false,
  });
  
  const { logAuthError } = useErrorLogger();

  const createClientAccount = useCallback(async (userId: string, userMetadata: any) => {
    setState(prev => ({ ...prev, isCreating: true, error: null }));

    try {
      console.log('Enhanced: Creating client account for user:', userId, userMetadata);
      
      // Use simplified approach - just ensure client record exists
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || user.id !== userId) {
        throw new Error('User not found or authentication mismatch');
      }

      // Use simplified diagnostics to ensure client record
      const result = await SimplifiedClientDiagnostics.ensureClientRecord(userId, user.email!, userMetadata);
      
      if (result.success) {
        // Verify client status
        await new Promise(resolve => setTimeout(resolve, 1000));
        const isClient = await SimplifiedClientDiagnostics.isClientAccount(userId);
        
        if (isClient) {
          console.log('Enhanced: Client account created successfully');
          setState(prev => ({ 
            ...prev, 
            isCreating: false, 
            isComplete: true, 
            diagnostic: result.data 
          }));
          return { 
            success: true, 
            result: { 
              userId,
              message: 'Client account created successfully using simplified approach',
              diagnostic: result.data
            }
          };
        } else {
          throw new Error('Client record created but verification failed');
        }
      } else {
        const errorMessage = result.error || 'Enhanced account creation failed';
        console.error('Enhanced: Account creation failed:', errorMessage);
        
        setState(prev => ({ 
          ...prev, 
          isCreating: false, 
          error: errorMessage,
          diagnostic: result.data,
          canRetry: true
        }));
        
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      console.error('Enhanced: Client account creation exception:', error);
      const errorMessage = error instanceof Error ? error.message : 'Account creation failed';
      
      await logAuthError(error, 'enhanced_client_account_creation_exception_simplified');
      
      setState(prev => ({ 
        ...prev, 
        isCreating: false, 
        error: errorMessage,
        canRetry: true
      }));
      
      return { success: false, error: errorMessage };
    }
  }, [logAuthError]);

  const reset = useCallback(() => {
    setState({
      isCreating: false,
      isComplete: false,
      error: null,
      diagnostic: null,
      canRetry: false,
    });
  }, []);

  const retry = useCallback(async (userId: string, userMetadata: any) => {
    console.log('Enhanced: Retrying account creation for user:', userId);
    return await createClientAccount(userId, userMetadata);
  }, [createClientAccount]);

  return {
    ...state,
    createClientAccount,
    reset,
    retry,
  };
}
