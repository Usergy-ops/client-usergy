
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { NetworkNodes } from '@/components/client/NetworkNodes';
import { useClientAuth } from '@/contexts/ClientAuthContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Processing authentication...');
  const [diagnosticInfo, setDiagnosticInfo] = useState<any>(null);
  const { refreshSession, diagnoseAccount } = useClientAuth();

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
        console.log('Provider:', session.user.app_metadata?.provider);
        
        if (mounted) {
          setStatus('Setting up your account...');
        }

        // Run diagnostic first
        const diagnosis = await diagnoseAccount(session.user.id);
        if (diagnosis && mounted) {
          setDiagnosticInfo(diagnosis);
        }

        // Refresh session to ensure we have the latest data
        await refreshSession();

        // For Google OAuth, give extra time for the trigger to complete
        if (session.user.app_metadata?.provider === 'google') {
          console.log('Google OAuth detected, waiting for account creation...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

        // Check if account is ready with polling
        console.log('Checking account readiness...');
        let isReady = false;
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts && mounted) {
          attempts++;
          console.log(`Account check attempt ${attempts}/${maxAttempts}`);

          try {
            const { data: isClient, error: checkError } = await supabase.rpc('is_client_account', {
              user_id_param: session.user.id
            });

            if (checkError) {
              console.error('Error checking account status:', checkError);
              
              // If check fails, try force creating the account
              console.log('Attempting to force create client account...');
              const { data: forceResult, error: forceError } = await supabase.rpc('force_create_client_account', {
                user_id_param: session.user.id
              });

              if (!forceError && forceResult) {
                console.log('Force create successful');
                isReady = true;
                break;
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
              const delay = Math.min(1000 * Math.pow(1.3, attempts - 1), 4000);
              console.log(`Waiting ${delay}ms before next attempt...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          } catch (pollError) {
            console.error('Error during polling:', pollError);
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }

        if (!mounted) return;

        if (isReady) {
          console.log('Account is ready, navigating to dashboard');
          setStatus('Account ready! Redirecting...');

          setTimeout(() => {
            if (mounted) {
              navigate('/dashboard', { replace: true });
            }
          }, 1000);
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
  }, [navigate, refreshSession, diagnoseAccount]);

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
        
        {diagnosticInfo && (
          <div className="mt-6 p-4 bg-muted rounded-lg text-left">
            <h3 className="text-sm font-semibold mb-2">Account Status:</h3>
            <div className="text-xs space-y-1">
              <div>User: {diagnosticInfo.user_exists ? '✓' : '✗'}</div>
              <div>Provider: {diagnosticInfo.user_provider}</div>
              <div>Account Type: {diagnosticInfo.account_type_exists ? '✓' : '✗'}</div>
              <div>Profile: {diagnosticInfo.profile_exists ? '✓' : '✗'}</div>
              <div>Is Client: {diagnosticInfo.is_client_account_result ? '✓' : '✗'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
