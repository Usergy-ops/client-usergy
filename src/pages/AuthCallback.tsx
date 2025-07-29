
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { NetworkNodes } from '@/components/client/NetworkNodes';
import { useClientAuth } from '@/contexts/ClientAuthContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { session, loading, waitForClientAccount, diagnoseAccount } = useClientAuth();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current || loading) {
      return;
    }

    const handleCallback = async () => {
      if (!session?.user?.id) {
        console.log('AuthCallback: No user session found, redirecting to home');
        navigate('/', { replace: true });
        return;
      }

      processedRef.current = true;
      const userId = session.user.id;
      console.log(`AuthCallback: Processing for user ${userId}`);

      try {
        // Give the database trigger some time to process the new user
        console.log('AuthCallback: Waiting for database trigger processing...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Wait for client account creation with more attempts
        const isClient = await waitForClientAccount(userId, 12);
        
        if (isClient) {
          console.log('AuthCallback: Client account confirmed, redirecting to dashboard');
          navigate('/dashboard', { replace: true });
        } else {
          // Diagnose what went wrong
          const diagnosis = await diagnoseAccount(userId);
          console.log('AuthCallback: Account diagnosis result:', diagnosis);
          
          if (diagnosis.user_exists && diagnosis.account_type_exists) {
            console.log('AuthCallback: User and account type exist but not client, redirecting to profile setup');
            navigate('/profile', { replace: true });
          } else {
            console.log('AuthCallback: Account setup incomplete, redirecting to home');
            navigate('/', { replace: true });
          }
        }
      } catch (error) {
        console.error('AuthCallback: Error during processing, redirecting to home', error);
        navigate('/', { replace: true });
      }
    };

    handleCallback();
  }, [session, loading, navigate, waitForClientAccount, diagnoseAccount]);

  return (
    <div className="min-h-screen relative flex items-center justify-center">
      <NetworkNodes />
      <div className="glass-card p-8 text-center relative z-10 max-w-md">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-lg font-semibold text-foreground">Setting up your account...</p>
        <p className="text-sm text-muted-foreground mt-2">
          {loading ? 'Loading...' : 'Please wait while we prepare your dashboard'}
        </p>
      </div>
    </div>
  );
}
