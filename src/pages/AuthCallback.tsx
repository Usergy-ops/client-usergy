
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { NetworkNodes } from '@/components/client/NetworkNodes';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { useClientAccountStatus } from '@/hooks/useClientAccountStatus';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Processing authentication...');
  const { refreshSession } = useClientAuth();
  const { pollForAccountReady } = useClientAccountStatus();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          console.error('No session found:', sessionError);
          setError('Authentication failed. Please try again.');
          setTimeout(() => navigate('/', { replace: true }), 3000);
          return;
        }

        console.log('Session found, refreshing and waiting for account...');
        setStatus('Setting up your account...');
        
        // Refresh session to ensure we have the latest data
        await refreshSession();
        
        // Wait for account to be ready
        const isReady = await pollForAccountReady(session.user.id);
        
        if (isReady) {
          console.log('Account is ready, navigating to dashboard');
          setStatus('Account ready! Redirecting...');
          
          // Small delay to show success message
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 1000);
        } else {
          console.error('Account not ready after polling');
          setError('Account setup took too long. Please try again.');
          setTimeout(() => navigate('/', { replace: true }), 3000);
        }
        
      } catch (error) {
        console.error('Auth callback error:', error);
        setError('An unexpected error occurred. Please try again.');
        setTimeout(() => navigate('/', { replace: true }), 3000);
      }
    };

    handleCallback();
  }, [navigate, refreshSession, pollForAccountReady]);

  return (
    <div className="min-h-screen relative flex items-center justify-center">
      <NetworkNodes />
      <div className="glass-card p-8 text-center relative z-10">
        {error ? (
          <>
            <div className="text-red-500 mb-4 text-lg font-semibold">{error}</div>
            <p className="text-sm text-muted-foreground">Redirecting to homepage...</p>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-lg font-semibold text-foreground">{status}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Please wait while we set up your account...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
