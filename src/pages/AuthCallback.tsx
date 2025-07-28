
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { NetworkNodes } from '@/components/client/NetworkNodes';
import { useClientAuth } from '@/contexts/ClientAuthContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Processing authentication...');
  const { refreshSession, accountCreationStatus } = useClientAuth();

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

        console.log('Session found, refreshing session to trigger account creation...');
        setStatus('Setting up your account...');
        
        // Refresh session to trigger the account creation process in ClientAuthContext
        await refreshSession();
        
        // Wait for account creation to complete
        console.log('Waiting for account creation to complete...');
        let retryCount = 0;
        const maxRetries = 10;
        
        while (retryCount < maxRetries) {
          if (accountCreationStatus.isComplete) {
            console.log('Account creation completed successfully');
            break;
          }
          
          if (accountCreationStatus.error) {
            console.error('Account creation failed:', accountCreationStatus.error);
            setError('Account setup failed. Please try again.');
            setTimeout(() => navigate('/', { replace: true }), 3000);
            return;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          retryCount++;
        }
        
        if (retryCount >= maxRetries) {
          console.error('Account creation timeout');
          setError('Account setup took too long. Please try again.');
          setTimeout(() => navigate('/', { replace: true }), 3000);
          return;
        }

        console.log('Account setup complete, navigating to dashboard');
        setStatus('Account created! Redirecting...');
        
        // Small delay to ensure everything is set up
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        navigate('/dashboard', { replace: true });
        
      } catch (error) {
        console.error('Auth callback error:', error);
        setError('An unexpected error occurred. Please try again.');
        setTimeout(() => navigate('/', { replace: true }), 3000);
      }
    };

    handleCallback();
  }, [navigate, refreshSession, accountCreationStatus]);

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
              {accountCreationStatus.isCreating ? 'Creating your client account...' : 'Almost there...'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
