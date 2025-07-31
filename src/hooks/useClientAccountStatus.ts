
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { SimplifiedClientDiagnostics } from '@/utils/simplifiedClientDiagnostics';

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
      console.log('Checking client account status for user:', userId);
      
      const isClient = await SimplifiedClientDiagnostics.isClientAccount(userId);
      
      setStatus({
        isClient,
        isLoading: false,
        error: null,
      });

      return isClient;
    } catch (error) {
      console.error('Exception checking client account status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage
      }));
      return false;
    }
  }, []);

  const ensureClientAccount = useCallback(async (userId: string, userMetadata: any): Promise<boolean> => {
    console.log('Ensuring client account exists for user:', userId, userMetadata);

    try {
      // Get user email from auth
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || user.id !== userId) {
        console.error('User not found or ID mismatch');
        return false;
      }

      // Use simplified client record creation
      const result = await SimplifiedClientDiagnostics.ensureClientRecord(userId, user.email!, userMetadata);
      
      if (result.success) {
        console.log('Client record ensured successfully:', result);
        return await checkAccountStatus(userId);
      }

      return false;
    } catch (error) {
      console.error('Exception ensuring client account:', error);
      return false;
    }
  }, [checkAccountStatus]);

  return {
    ...status,
    checkAccountStatus,
    ensureClientAccount,
  };
}
