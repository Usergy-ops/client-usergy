
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { NetworkNodes } from '@/components/client/NetworkNodes';
import { useClientAuth } from '@/contexts/ClientAuthContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Processing authentication...');
  const { refreshSession } = useClientAuth();

  useEffect(() => {
    let mounted = true;

    const handleCallback = async () => {
      try {
        console.log('Starting auth callback...');
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
          console.error('No session found:', sessionError);
          if (mounted) {
            setError('Authentication failed. Please try again.');
            setTimeout(() => navigate('/', { replace: true }), 3000);
          }
          return;
        }

        console.log('Session found for user:', session.user.email);
        
        if (mounted) {
          setStatus('Setting up your account...');
        }

        // Refresh session to ensure we have the latest data
        await refreshSession();

        // For Google OAuth, give time for the database trigger to complete
        if (session.user.app_metadata?.provider === 'google') {
          console.log('Google OAuth detected, waiting for account creation...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Check if account is ready with limited polling
        console.log('Checking account readiness...');
        let isReady = false;
        let attempts = 0;
        const maxAttempts = 5; // Reduced from 10

        while (attempts < maxAttempts && mounted) {
          attempts++;
          console.log(`Account check attempt ${attempts}/${maxAttempts}`);

          try {
            const { data: isClient, error: checkError } = await supabase.rpc('is_client_account', {
              user_id_param: session.user.id
            });

            if (checkError) {
              console.error('Error checking account status:', checkError);
              // Don't try to force create on every error - just log it
              if (attempts === maxAttempts) {
                console.log('Max attempts reached, trying force create...');
                const { data: forceResult, error: forceError } = await supabase.rpc('force_create_client_account', {
                  user_id_param: session.user.id
                });

                if (!forceError && forceResult) {
                  console.log('Force create successful');
                  isReady = true;
                  break;
                }
              }
            } else {
              isReady = Boolean(isClient);
              console.log('Account status check result:', isReady);
            }

            if (isReady) {
              console.log('Account is ready!');
              break;
            }

            if (attempts < maxAttempts) {
              const delay = Math.min(1000 * Math.pow(1.2, attempts - 1), 3000); // Reduced delay
              console.log(`Waiting ${delay}ms before next attempt...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          } catch (pollError) {
            console.error('Error during polling:', pollError);
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 1500));
            }
          }
        }

        if (!mounted) return;

        if (isReady) {
          console.log('Account is ready, navigating to dashboard');
          setStatus('Account ready! Redirecting...');
          navigate('/dashboard', { replace: true });
        } else {
          console.error('Account not ready after polling');
          setError('Account setup took too long. Please try signing in again.');
          setTimeout(() => {
            if (mounted) {
              navigate('/', { replace: true });
            }
          }, 3000);
        }

      } catch (error) {
        console.error('Auth callback error:', error);
        if (mounted) {
          setError('An unexpected error occurred. Please try again.');
          setTimeout(() => navigate('/', { replace: true }), 3000);
        }
      }
    };

    handleCallback();

    return () => {
      mounted = false;
    };
  }, [navigate, refreshSession]);

  return (
    <div className="min-h-screen relative flex items-center justify-center">
      <NetworkNodes />
      <div className="glass-card p-8 text-center relative z-10 max-w-md">
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
