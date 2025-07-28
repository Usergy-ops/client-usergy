
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { NetworkNodes } from '@/components/client/NetworkNodes';
import { useClientAuth } from '@/contexts/ClientAuthContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { user, session, isClientAccount, loading, refreshSession, waitForClientAccount } = useClientAuth();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;

    const handleCallback = async () => {
      processedRef.current = true;
      
      console.log('AuthCallback: Processing authentication callback...');
      
      try {
        // Wait for auth to settle
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Refresh session to ensure we have latest state
        await refreshSession();
        
        // Give context time to update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Navigate based on final state
        if (user && session) {
          if (isClientAccount) {
            console.log('AuthCallback: Client authenticated, redirecting to dashboard');
            navigate('/dashboard', { replace: true });
          } else {
            console.log('AuthCallback: User authenticated but not client, waiting for account...');
            const isClient = await waitForClientAccount(user.id, 10);
            if (isClient) {
              console.log('AuthCallback: Client account confirmed, redirecting to dashboard');
              navigate('/dashboard', { replace: true });
            } else {
              console.log('AuthCallback: Failed to confirm client account, redirecting to home');
              navigate('/', { replace: true });
            }
          }
        } else {
          console.log('AuthCallback: No user or session found, redirecting to home');
          navigate('/', { replace: true });
        }
      } catch (error) {
        console.error('AuthCallback: Error processing callback:', error);
        navigate('/', { replace: true });
      }
    };

    // Only process if not loading
    if (!loading) {
      handleCallback();
    }
  }, [user, session, isClientAccount, loading, navigate, refreshSession, waitForClientAccount]);

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
