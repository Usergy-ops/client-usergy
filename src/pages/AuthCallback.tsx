
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { NetworkNodes } from '@/components/client/NetworkNodes';
import { useClientAuth } from '@/contexts/ClientAuthContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Processing authentication...');
  const { refreshSession } = useClientAuth();
  const processedRef = useRef(false);

  useEffect(() => {
    // Prevent double processing
    if (processedRef.current) return;
    processedRef.current = true;

    const handleCallback = async () => {
      try {
        console.log('AuthCallback: Starting authentication process...');
        
        // Step 1: Get current session with retries
        let session = null;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!session && attempts < maxAttempts) {
          attempts++;
          console.log(`AuthCallback: Attempt ${attempts} to get session...`);
          
          const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            console.error('AuthCallback: Session error:', sessionError);
            if (attempts === maxAttempts) {
              throw sessionError;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }
          
          session = currentSession;
          
          if (!session) {
            console.log('AuthCallback: No session, waiting...');
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        if (!session) {
          console.error('AuthCallback: No session found after retries');
          setError('Authentication failed. Please try again.');
          setTimeout(() => navigate('/', { replace: true }), 2000);
          return;
        }

        console.log('AuthCallback: Session found for user:', session.user.email);
        setStatus('Setting up your account...');

        // Step 2: Ensure client account exists
        console.log('AuthCallback: Ensuring client account...');
        
        const { data: result, error: createError } = await supabase.rpc('ensure_client_account', {
          user_id_param: session.user.id,
          company_name_param: session.user.user_metadata?.companyName || 'My Company',
          first_name_param: session.user.user_metadata?.contactFirstName || 
                           session.user.user_metadata?.full_name?.split(' ')[0] || '',
          last_name_param: session.user.user_metadata?.contactLastName || 
                          session.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || ''
        });

        if (createError) {
          console.error('AuthCallback: Error ensuring account:', createError);
          setError('Unable to set up your account. Please try again.');
          setTimeout(() => navigate('/', { replace: true }), 3000);
          return;
        }

        if (!result?.success) {
          console.error('AuthCallback: Account creation failed:', result);
          setError('Unable to set up your account. Please try again.');
          setTimeout(() => navigate('/', { replace: true }), 3000);
          return;
        }

        console.log('AuthCallback: Client account confirmed');

        // Step 3: Refresh auth context with delay to ensure DB consistency
        setStatus('Finalizing setup...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await refreshSession();

        // Step 4: Additional delay to ensure context is fully updated
        await new Promise(resolve => setTimeout(resolve, 500));

        // Step 5: Navigate to dashboard
        console.log('AuthCallback: Redirecting to dashboard...');
        setStatus('Welcome! Redirecting to your dashboard...');
        
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 500);

      } catch (error) {
        console.error('AuthCallback: Unexpected error:', error);
        setError('An unexpected error occurred. Please try again.');
        setTimeout(() => navigate('/', { replace: true }), 3000);
      }
    };

    handleCallback();
  }, [navigate, refreshSession]);

  return (
    <div className="min-h-screen relative flex items-center justify-center">
      <NetworkNodes />
      <div className="glass-card p-8 text-center relative z-10 max-w-md">
        {error ? (
          <>
            <div className="text-red-500 mb-4 text-lg font-semibold">{error}</div>
            <p className="text-sm text-muted-foreground">Redirecting...</p>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-lg font-semibold text-foreground">{status}</p>
            <p className="text-sm text-muted-foreground mt-2">Please wait...</p>
          </>
        )}
      </div>
    </div>
  );
}
