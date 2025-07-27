
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
    const handleCallback = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          console.error('No session found:', sessionError);
          setError('Authentication failed. Please try again.');
          setTimeout(() => navigate('/'), 3000);
          return;
        }

        console.log('Session found, checking/creating client account...');
        setStatus('Setting up your account...');
        
        try {
          // First, refresh the session to ensure we have the latest data
          await refreshSession();
          
          // Check if client account already exists
          const { data: existingAccount, error: checkError } = await supabase
            .from('account_types')
            .select('account_type')
            .eq('auth_user_id', session.user.id)
            .eq('account_type', 'client')
            .single();

          if (checkError && checkError.code !== 'PGRST116') {
            console.error('Error checking existing account:', checkError);
          }

          if (existingAccount) {
            console.log('Client account exists, redirecting to dashboard');
            navigate('/dashboard');
            return;
          }

          // Create new client account using the RPC function
          console.log('Creating new client account...');
          setStatus('Creating your client account...');
          
          const { error: createError } = await supabase.rpc('create_client_account_for_user', {
            user_id_param: session.user.id,
            company_name_param: session.user.user_metadata?.companyName || 'My Company',
            first_name_param: session.user.user_metadata?.contactFirstName || session.user.user_metadata?.full_name?.split(' ')[0] || '',
            last_name_param: session.user.user_metadata?.contactLastName || session.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || ''
          });

          if (createError) {
            console.error('Error creating client account:', createError);
            setError('Account setup failed. Please try again.');
            setTimeout(() => navigate('/'), 3000);
            return;
          }

          console.log('Client account created successfully');
          setStatus('Account created! Redirecting...');
          
          // Refresh session again to ensure the new account data is loaded
          await refreshSession();
          
          // Small delay to ensure everything is set up
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          navigate('/dashboard');
          
        } catch (dbError) {
          console.error('Database error:', dbError);
          setError('Account setup failed. Please try again.');
          setTimeout(() => navigate('/'), 3000);
        }
        
      } catch (error) {
        console.error('Auth callback error:', error);
        setError('An unexpected error occurred. Please try again.');
        setTimeout(() => navigate('/'), 3000);
      }
    };

    handleCallback();
  }, [navigate, refreshSession]);

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
            <p className="text-sm text-muted-foreground mt-2">Almost there...</p>
          </>
        )}
      </div>
    </div>
  );
}
