
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useErrorLogger } from './useErrorLogger';

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
      
      const { data: rawResult, error } = await supabase.functions.invoke('client-auth-handler/signup', {
        body: {
          email: userMetadata.email,
          password: userMetadata.password,
          companyName: userMetadata?.companyName || userMetadata?.company_name || 'My Company',
          firstName: userMetadata?.contactFirstName || 
            userMetadata?.first_name ||
            userMetadata?.full_name?.split(' ')[0] || 'User',
          lastName: userMetadata?.contactLastName || 
            userMetadata?.last_name ||
            userMetadata?.full_name?.split(' ').slice(1).join(' ') || ''
        }
      });

      if (error) {
        console.error('Enhanced: Edge function call failed:', error);
        await logAuthError(error, 'enhanced_client_account_creation');
        
        setState(prev => ({ 
          ...prev, 
          isCreating: false, 
          error: `Account creation failed: ${error.message}`,
          canRetry: true
        }));
        
        return { success: false, error: error.message };
      }

      console.log('Enhanced: Account creation result:', rawResult);

      const result = rawResult as CreateClientAccountResult;
      
      if (result.success) {
        console.log('Enhanced: Client account created successfully');
        setState(prev => ({ 
          ...prev, 
          isCreating: false, 
          isComplete: true, 
          diagnostic: result.diagnostic 
        }));
        return { success: true, result };
      } else {
        const errorMessage = result.error || 'Account creation failed';
        console.error('Enhanced: Account creation failed:', errorMessage);
        
        setState(prev => ({ 
          ...prev, 
          isCreating: false, 
          error: errorMessage,
          diagnostic: result.diagnostic,
          canRetry: result.can_retry || false
        }));
        
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      console.error('Enhanced: Client account creation exception:', error);
      const errorMessage = error instanceof Error ? error.message : 'Account creation failed';
      
      await logAuthError(error, 'enhanced_client_account_creation_exception');
      
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
