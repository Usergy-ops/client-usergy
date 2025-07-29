
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

  const ensureClientAccount = useCallback(async (userId: string, userMetadata: any): Promise<boolean> => {
    console.log('Ensuring client account exists for user:', userId);
    
    try {
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
        console.error('Error ensuring client account:', error);
        return false;
      }

      if (result?.success && result?.is_client_account) {
        console.log('Client account ensured successfully');
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
