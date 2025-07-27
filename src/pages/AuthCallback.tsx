
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { NetworkNodes } from '@/components/client/NetworkNodes';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Verifying access...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('Auth callback - getting session...');
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          console.error('No session found:', sessionError);
          setError('Authentication failed. Please try again.');
          setTimeout(() => navigate('/'), 3000);
          return;
        }

        console.log('Session found for user:', session.user.id);
        setStatus('Setting up your account...');
        
        // For Google OAuth users, ensure they have a client account
        if (session.user.app_metadata?.provider === 'google') {
          console.log('Google OAuth user detected, ensuring client account...');
          
          // Try to create client account if it doesn't exist
          const { error: createError } = await supabase.rpc('create_client_account_for_user', {
            user_id_param: session.user.id,
            company_name_param: 'My Company',
            first_name_param: session.user.user_metadata?.full_name?.split(' ')[0] || '',
            last_name_param: session.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || ''
          });
          
          if (createError) {
            console.error('Error creating client account:', createError);
          }
        }
        
        // Give time for database triggers to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if user is now a client using the RPC function
        const { data: clientCheck, error: clientError } = await supabase.rpc('check_user_is_client', {
          user_id_param: session.user.id
        });
        
        if (clientError) {
          console.error('Client check error:', clientError);
          setError('Account verification failed. Please try again.');
          setTimeout(() => navigate('/'), 3000);
          return;
        }
        
        console.log('Client check result:', clientCheck);
        
        if (clientCheck?.is_client) {
          console.log('User is a client, redirecting to dashboard');
          navigate('/dashboard');
        } else {
          console.log('User is not a client, creating account...');
          // Try one more time to create client account
          const { error: retryError } = await supabase.rpc('create_client_account_for_user', {
            user_id_param: session.user.id,
            company_name_param: 'My Company',
            first_name_param: session.user.user_metadata?.full_name?.split(' ')[0] || '',
            last_name_param: session.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || ''
          });
          
          if (retryError) {
            console.error('Retry error:', retryError);
            setError('Account setup failed. Please try again.');
            setTimeout(() => navigate('/'), 3000);
          } else {
            console.log('Client account created successfully, redirecting to dashboard');
            navigate('/dashboard');
          }
        }
        
      } catch (error) {
        console.error('Auth callback error:', error);
        setError('An unexpected error occurred. Please try again.');
        setTimeout(() => navigate('/'), 3000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen relative flex items-center justify-center">
      <NetworkNodes />
      <div className="glass-card p-8 text-center">
        {error ? (
          <>
            <div className="text-red-500 mb-4">{error}</div>
            <p className="text-sm text-muted-foreground">Redirecting...</p>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-lg">{status}</p>
          </>
        )}
      </div>
    </div>
  );
}
