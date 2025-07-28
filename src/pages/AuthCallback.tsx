
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
        console.log('Starting optimized auth callback...');
        
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

        // Refresh session to ensure context is updated
        await refreshSession();

        // For all users, try to ensure client account exists
        console.log('Ensuring client account exists...');
        
        const { data: createResult, error: createError } = await supabase.rpc('create_client_account_safe', {
          user_id_param: session.user.id,
          company_name_param: 'My Company',
          first_name_param: session.user.user_metadata?.full_name?.split(' ')[0] || 
                           session.user.user_metadata?.contactFirstName || '',
          last_name_param: session.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || 
                          session.user.user_metadata?.contactLastName || ''
        });

        if (createError) {
          console.error('Error with safe account creation:', createError);
        } else {
          console.log('Safe account creation result:', createResult);
        }

        // Single verification check with shorter timeout
        console.log('Verifying account status...');
        const { data: isClient, error: checkError } = await supabase.rpc('is_client_account', {
          user_id_param: session.user.id
        });

        if (!mounted) return;

        if (checkError) {
          console.error('Error checking account status:', checkError);
          setError('Account verification failed. Please try signing in again.');
          setTimeout(() => navigate('/', { replace: true }), 3000);
          return;
        }

        const isClientAccount = Boolean(isClient);
        console.log('Account verification result:', isClientAccount);

        if (isClientAccount) {
          console.log('Account verified, redirecting to dashboard');
          setStatus('Account ready! Redirecting...');
          // Small delay to show success message
          setTimeout(() => {
            if (mounted) {
              navigate('/dashboard', { replace: true });
            }
          }, 1000);
        } else {
          console.error('Account verification failed');
          setError('Account setup incomplete. Please try signing in again.');
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
