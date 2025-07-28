
import { ReactNode, useEffect, useState } from 'react';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface ClientProtectedRouteProps {
  children: ReactNode;
}

export function ClientProtectedRoute({ children }: ClientProtectedRouteProps) {
  const { user, loading, isClientAccount } = useClientAuth();
  const navigate = useNavigate();
  const [accountStatus, setAccountStatus] = useState<{
    isReady: boolean;
    isLoading: boolean;
    error: string | null;
  }>({
    isReady: false,
    isLoading: false,
    error: null,
  });

  const pollForAccountReady = async (userId: string, maxAttempts = 6): Promise<boolean> => {
    console.log('Polling for account readiness for user:', userId);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`Account check attempt ${attempt}/${maxAttempts}`);

      try {
        const { data: isClient, error: checkError } = await supabase.rpc('is_client_account', {
          user_id_param: userId
        });

        if (checkError) {
          console.error('Error checking account status:', checkError);
        } else {
          const isReady = Boolean(isClient);
          console.log('Account status check result:', isReady);
          
          if (isReady) {
            console.log('Account is ready!');
            return true;
          }
        }

        if (attempt < maxAttempts) {
          // Wait before next attempt, with exponential backoff
          const delay = Math.min(1000 * Math.pow(1.5, attempt - 1), 3000);
          console.log(`Waiting ${delay}ms before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (pollError) {
        console.error('Error during polling:', pollError);
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    }

    console.log('Account not ready after polling');
    return false;
  };

  useEffect(() => {
    const checkAccountReady = async () => {
      if (loading) return;

      if (!user) {
        console.log('No authenticated user, redirecting to home');
        navigate('/', { replace: true });
        return;
      }

      // If we already know the user is a client, we're good
      if (isClientAccount) {
        setAccountStatus({ isReady: true, isLoading: false, error: null });
        return;
      }

      setAccountStatus(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const isReady = await pollForAccountReady(user.id);

        if (isReady) {
          setAccountStatus({ isReady: true, isLoading: false, error: null });
        } else {
          console.log('Account not ready, redirecting to home');
          setAccountStatus({ isReady: false, isLoading: false, error: 'Account setup incomplete' });
          navigate('/', { replace: true });
        }
      } catch (error) {
        console.error('Error checking account status:', error);
        setAccountStatus({ 
          isReady: false, 
          isLoading: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        navigate('/', { replace: true });
      }
    };

    checkAccountReady();
  }, [user, loading, isClientAccount, navigate]);

  if (loading || accountStatus.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="glass-card p-8">
          <div className="flex items-center space-x-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <div className="space-y-2">
              <span className="text-lg font-semibold">
                {loading ? 'Loading...' : 'Setting up your account...'}
              </span>
              <p className="text-sm text-muted-foreground">
                {loading ? 'Please wait' : 'Please wait while we prepare your dashboard'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (accountStatus.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="glass-card p-8 text-center">
          <div className="text-red-500 mb-4 text-lg font-semibold">Account Setup Issue</div>
          <p className="text-sm text-muted-foreground mb-4">{accountStatus.error}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (user && (isClientAccount || accountStatus.isReady)) {
    return <>{children}</>;
  }

  return null;
}
