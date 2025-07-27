
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
        
        // First, ensure the user has a client account
        const { data: createResult, error: createError } = await supabase.rpc('create_client_account_for_user', {
          user_id_param: session.user.id,
          company_name_param: 'My Company',
          first_name_param: session.user.user_metadata?.full_name?.split(' ')[0] || '',
          last_name_param: session.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || ''
        });
        
        if (createError) {
          console.error('Error creating client account:', createError);
          // Don't fail here - might already exist
        }
        
        // Wait a moment for database operations to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verify client status
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
          console.log('User is verified as client, redirecting to dashboard');
          navigate('/dashboard');
        } else {
          console.log('User is not a client account');
          setError('Account setup incomplete. Please contact support.');
          setTimeout(() => navigate('/'), 3000);
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
            <p className="text-sm text-muted-foreground mt-2">This may take a moment</p>
          </>
        )}
      </div>
    </div>
  );
}
