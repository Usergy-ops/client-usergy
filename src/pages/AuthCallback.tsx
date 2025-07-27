import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Handle the OAuth callback
    const handleAuthStateChange = async (event: string, session: any) => {
      if (event === 'SIGNED_IN' && session) {
        try {
          console.log('Auth callback - user signed in:', session.user.id);
          
          // First check if user has a client account type
          const { data: accountType, error: accountError } = await supabase
            .from('account_types')
            .select('account_type')
            .eq('auth_user_id', session.user.id)
            .single();

          // If no client account exists, check if this is a Google OAuth user
          if (accountError || !accountType) {
            const userMetadata = session.user.user_metadata;
            const isGoogleUser = userMetadata?.provider === 'google' || session.user.app_metadata?.provider === 'google';
            
            if (isGoogleUser) {
              console.log('Google OAuth user without client account - creating client account');
              
              // Create client account for Google OAuth user
              const { data: created, error: createError } = await supabase.rpc(
                'create_client_account_for_user',
                {
                  user_id_param: session.user.id,
                  company_name_param: 'My Company',
                  first_name_param: userMetadata?.given_name || userMetadata?.name?.split(' ')[0] || null,
                  last_name_param: userMetadata?.family_name || userMetadata?.name?.split(' ').slice(1).join(' ') || null
                }
              );
              
              if (createError) {
                console.error('Error creating client account for Google user:', createError);
                // Redirect to user portal instead of failing
                window.location.href = 'https://user.usergy.ai';
                return;
              }
              
              console.log('Client account created for Google user');
            } else {
              console.log('User without client account - redirecting to user portal');
              window.location.href = 'https://user.usergy.ai';
              return;
            }
          }

          // Now check for client profile completion
          const { data: profile, error: profileError } = await supabase
            .schema('client_workspace')
            .from('company_profiles')
            .select('onboarding_status')
            .eq('auth_user_id', session.user.id)
            .single();

          if (profileError) {
            console.error('Error checking client profile:', profileError);
            // If profile doesn't exist, go to profile setup
            navigate('/profile');
            return;
          }

          if (profile?.onboarding_status === 'complete') {
            console.log('Client profile complete - redirecting to dashboard');
            navigate('/dashboard');
          } else {
            console.log('Client profile incomplete - redirecting to profile setup');
            navigate('/profile');
          }
          
        } catch (error) {
          console.error('Error in auth callback:', error);
          // Log error to database if possible
          try {
            await supabase.from('error_logs').insert({
              error_type: 'auth_callback_error',
              error_message: error.message,
              context: 'auth_callback',
              user_id: session?.user?.id,
              metadata: {
                error_detail: error.stack,
                session_provider: session?.user?.app_metadata?.provider
              }
            });
          } catch (logError) {
            console.error('Failed to log error:', logError);
          }
          
          // Default to profile setup on error
          navigate('/profile');
        }
      } else if (event === 'SIGNED_OUT') {
        navigate('/');
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthStateChange);

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-lg text-muted-foreground">Processing authentication...</p>
      </div>
    </div>
  );
}