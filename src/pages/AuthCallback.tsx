
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

        // Refresh session to ensure context is updated
        await refreshSession();

        // Use the new ensure_client_account function
        console.log('Ensuring client account exists...');
        
        const { data: result, error: ensureError } = await supabase.rpc('ensure_client_account', {
          user_id_param: session.user.id,
          company_name_param: session.user.user_metadata?.companyName || 'My Company',
          first_name_param: session.user.user_metadata?.full_name?.split(' ')[0] || 
                           session.user.user_metadata?.contactFirstName || '',
          last_name_param: session.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || 
                          session.user.user_metadata?.contactLastName || ''
        });

        if (!mounted) return;

        if (ensureError) {
          console.error('Error ensuring client account:', ensureError);
          setError('Account setup failed. Please try signing in again.');
          setTimeout(() => navigate('/', { replace: true }), 3000);
          return;
        }

        if (result?.success && result?.is_client) {
          console.log('Client account ready, redirecting to dashboard');
          setStatus('Account ready! Redirecting...');
          setTimeout(() => {
            if (mounted) {
              navigate('/dashboard', { replace: true });
            }
          }, 1000);
        } else {
          console.error('Client account setup failed:', result);
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
