
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { NetworkNodes } from '@/components/client/NetworkNodes';
import { useClientAuth } from '@/contexts/ClientAuthContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { user, isClientAccount, loading, refreshSession, waitForClientAccount } = useClientAuth();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current || loading) return;

    const handleCallback = async () => {
      processedRef.current = true;
      
      console.log('AuthCallback: Processing authentication callback...');
      
      // Wait a moment for auth to settle
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh session to ensure we have latest state
      await refreshSession();
      
      // Give context time to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Navigate based on final state
      if (user && isClientAccount) {
        console.log('AuthCallback: Client authenticated, redirecting to dashboard');
        navigate('/dashboard', { replace: true });
      } else if (user) {
        console.log('AuthCallback: User authenticated but not client, ensuring account...');
        const isClient = await waitForClientAccount(user.id);
        if (isClient) {
          navigate('/dashboard', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } else {
        console.log('AuthCallback: No user found, redirecting to home');
        navigate('/', { replace: true });
      }
    };

    handleCallback();
  }, [user, isClientAccount, loading, navigate, refreshSession, waitForClientAccount]);

  return (
    <div className="min-h-screen relative flex items-center justify-center">
      <NetworkNodes />
      <div className="glass-card p-8 text-center relative z-10 max-w-md">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-lg font-semibold text-foreground">Setting up your account...</p>
        <p className="text-sm text-muted-foreground mt-2">Please wait...</p>
      </div>
    </div>
  );
}
