import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { NetworkNodes } from '@/components/client/NetworkNodes';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

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

        console.log('Session found for user:', session.user.id);
        
        // For Google OAuth users, create client account
        const isGoogleUser = session.user.app_metadata?.provider === 'google';
        
        if (isGoogleUser) {
          // Create account type
          await supabase
            .from('account_types')
            .insert({
              auth_user_id: session.user.id,
              account_type: 'client'
            })
            .select()
            .single();
          
          // Create or update company profile
          await supabase
            .from('client_workspace.company_profiles')
            .upsert({
              auth_user_id: session.user.id,
              contact_first_name: session.user.user_metadata?.full_name?.split(' ')[0] || '',
              contact_last_name: session.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
              company_name: '',
              billing_email: session.user.email || ''
            }, {
              onConflict: 'auth_user_id'
            });
        }
        
        // Wait for profile to be created
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check profile completion status
        const { data: profile } = await supabase
          .from('client_workspace.company_profiles')
          .select('onboarding_status')
          .eq('auth_user_id', session.user.id)
          .single();
        
        if (profile?.onboarding_status === 'complete') {
          navigate('/dashboard');
        } else {
          navigate('/profile');
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
            <p className="text-lg">Verifying access...</p>
          </>
        )}
      </div>
    </div>
  );
}