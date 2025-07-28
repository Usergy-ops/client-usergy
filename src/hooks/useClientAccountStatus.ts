
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface AccountStatus {
  isClient: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useClientAccountStatus() {
  const [status, setStatus] = useState<AccountStatus>({
    isClient: false,
    isLoading: false,
    error: null,
  });

  const checkAccountStatus = useCallback(async (userId: string): Promise<boolean> => {
    setStatus(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data: isClient, error } = await supabase.rpc('is_client_account', {
        user_id_param: userId
      });

      if (error) {
        console.error('Error checking client account status:', error);
        setStatus(prev => ({ ...prev, isLoading: false, error: error.message }));
        return false;
      }

      const isClientAccount = Boolean(isClient);
      setStatus({
        isClient: isClientAccount,
        isLoading: false,
        error: null,
      });

      return isClientAccount;
    } catch (error) {
      console.error('Exception checking client account status:', error);
      setStatus(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }));
      return false;
    }
  }, []);

  const pollForAccountReady = useCallback(async (userId: string, maxAttempts = 3): Promise<boolean> => {
    console.log('Polling for client account readiness...');
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`Account check attempt ${attempt}/${maxAttempts}`);
      
      const isReady = await checkAccountStatus(userId);
      
      if (isReady) {
        console.log('Client account is ready!');
        return true;
      }

      if (attempt < maxAttempts) {
        // Short delay between attempts
        const delay = 1000 * attempt;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    console.log('Account not ready after polling');
    return false;
  }, [checkAccountStatus]);

  return {
    ...status,
    checkAccountStatus,
    pollForAccountReady,
  };
}
