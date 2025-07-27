
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { NetworkNodes } from '@/components/client/NetworkNodes';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Processing authentication...');

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
        
        try {
          // Check if client account already exists
          const { data: existingAccount } = await supabase
            .from('account_types')
            .select('account_type')
            .eq('auth_user_id', session.user.id)
            .eq('account_type', 'client')
            .single();

          if (existingAccount) {
            console.log('Client account exists, redirecting to dashboard');
            navigate('/dashboard');
            return;
          }

          // Create new client account
          console.log('Creating new client account...');
          
          // Create account type record
          const { error: accountError } = await supabase
            .from('account_types')
            .insert({ auth_user_id: session.user.id, account_type: 'client' });

          if (accountError) {
            console.error('Error creating account type:', accountError);
          }

          // Create company profile
          const { error: profileError } = await supabase
            .from('client_workspace.company_profiles')
            .insert({
              auth_user_id: session.user.id,
              company_name: 'My Company',
              contact_first_name: session.user.user_metadata?.full_name?.split(' ')[0] || '',
              contact_last_name: session.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
              billing_email: session.user.email,
              onboarding_status: 'completed'
            });

          if (profileError) {
            console.error('Error creating company profile:', profileError);
          }

          console.log('Client account created successfully, redirecting to dashboard');
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
            <p className="text-sm text-muted-foreground mt-2">Almost there...</p>
          </>
        )}
      </div>
    </div>
  );
}
