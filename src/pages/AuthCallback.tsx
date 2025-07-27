
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
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          console.error('No session found:', sessionError);
          setError('Authentication failed. Please try again.');
          setTimeout(() => navigate('/'), 3000);
          return;
        }

        console.log('Session found for user:', session.user.id);
        setStatus('Setting up your account...');
        
        // For Google OAuth users, the trigger should have already created the account
        // But let's double-check and handle any edge cases
        const isGoogleUser = session.user.app_metadata?.provider === 'google';
        
        if (isGoogleUser) {
          console.log('Google OAuth user detected, checking account status...');
          
          // Wait a moment for the trigger to complete
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Check if the user is now a client
          const { data: clientCheck } = await supabase.rpc('check_user_is_client', {
            user_id_param: session.user.id
          });
          
          console.log('Client check result:', clientCheck);
          
          if (!clientCheck?.is_client) {
            console.log('User not detected as client, attempting manual creation...');
            
            // Extract name parts for manual creation
            const fullName = session.user.user_metadata?.full_name || '';
            const nameParts = fullName.split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';
            
            // Manually create the client account
            const { data: creationResult } = await supabase.rpc('create_client_account_for_user', {
              user_id_param: session.user.id,
              company_name_param: 'My Company',
              first_name_param: firstName,
              last_name_param: lastName
            });
            
            console.log('Manual creation result:', creationResult);
            
            if (!creationResult?.success) {
              console.error('Failed to create client account:', creationResult);
              setError('Failed to set up your account. Please try again.');
              setTimeout(() => navigate('/'), 3000);
              return;
            }
          }
        }
        
        setStatus('Checking your profile...');
        
        // Wait for profile to be fully set up
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check profile completion status using client_workspace schema
        const { data: profile, error: profileError } = await supabase
          .from('client_workspace.company_profiles')
          .select('onboarding_status')
          .eq('auth_user_id', session.user.id)
          .maybeSingle();
        
        if (profileError) {
          console.error('Profile check error:', profileError);
          setError('Failed to check profile status. Please try again.');
          setTimeout(() => navigate('/'), 3000);
          return;
        }
        
        if (profile?.onboarding_status === 'complete') {
          console.log('Profile complete, redirecting to dashboard');
          navigate('/dashboard');
        } else {
          console.log('Profile incomplete, redirecting to profile setup');
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
            <p className="text-lg">{status}</p>
          </>
        )}
      </div>
    </div>
  );
}
