
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { redirectToDashboard, redirectToUserPortal, logRedirect } from '@/utils/authRedirectUtils';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthStateChange = async (event: string, session: any) => {
      console.log('AuthCallback - Event:', event, 'Session:', session?.user?.id);
      
      if (event === 'SIGNED_IN' && session) {
        try {
          console.log('Auth callback - user signed in:', session.user.id);
          
          // Wait a moment for any database operations to complete
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Check if user has a client account type with retry logic
          let retryCount = 0;
          const maxRetries = 3;
          let accountType = null;

          while (retryCount < maxRetries && !accountType) {
            const { data, error } = await supabase
              .from('account_types')
              .select('account_type')
              .eq('auth_user_id', session.user.id)
              .eq('account_type', 'client')
              .maybeSingle();

            if (error) {
              console.error('Error checking account type (attempt', retryCount + 1, '):', error);
              retryCount++;
              if (retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
              }
            } else {
              accountType = data;
              break;
            }
          }

          // If no client account exists, check if this is a Google OAuth user
          if (!accountType) {
            const userMetadata = session.user.user_metadata;
            const appMetadata = session.user.app_metadata;
            const isGoogleUser = userMetadata?.provider === 'google' || appMetadata?.provider === 'google';
            
            console.log('No client account found. Google user?', isGoogleUser);
            console.log('User metadata:', userMetadata);
            console.log('App metadata:', appMetadata);
            
            if (isGoogleUser) {
              console.log('Google OAuth user without client account - creating client account');
              
              // Create client account for Google OAuth user
              const { data: created, error: createError } = await supabase.rpc(
                'create_client_account_for_user',
                {
                  user_id_param: session.user.id,
                  company_name_param: userMetadata?.company_name || 'My Company',
                  first_name_param: userMetadata?.given_name || userMetadata?.name?.split(' ')[0] || userMetadata?.full_name?.split(' ')[0] || null,
                  last_name_param: userMetadata?.family_name || userMetadata?.name?.split(' ').slice(1).join(' ') || userMetadata?.full_name?.split(' ').slice(1).join(' ') || null
                }
              );
              
              if (createError) {
                console.error('Error creating client account for Google user:', createError);
                
                // Log the error
                await supabase.from('error_logs').insert({
                  error_type: 'google_oauth_client_creation_error',
                  error_message: createError.message,
                  context: 'auth_callback',
                  user_id: session?.user?.id,
                  metadata: {
                    error_detail: createError,
                    provider: 'google',
                    user_metadata: userMetadata,
                    app_metadata: appMetadata
                  }
                });
                
                // Redirect to user portal instead of failing
                logRedirect('Google OAuth client account creation failed', 'user portal', { 
                  userId: session.user.id,
                  error: createError.message 
                });
                redirectToUserPortal();
                return;
              }
              
              console.log('Client account created for Google user - redirecting to dashboard');
              logRedirect('Google OAuth client account created successfully', 'dashboard', { 
                userId: session.user.id,
                created: created 
              });
              redirectToDashboard();
              return;
            } else {
              console.log('User without client account - redirecting to user portal');
              logRedirect('User without client account', 'user portal', { 
                userId: session.user.id,
                isGoogleUser: false 
              });
              redirectToUserPortal();
              return;
            }
          }

          // User has client account, redirect to dashboard
          console.log('Client account found - redirecting to dashboard');
          logRedirect('Client account verified', 'dashboard', { 
            userId: session.user.id,
            accountType: accountType 
          });
          redirectToDashboard();
          
        } catch (error) {
          console.error('Error in auth callback:', error);
          
          // Log error to database
          try {
            await supabase.from('error_logs').insert({
              error_type: 'auth_callback_error',
              error_message: error.message,
              context: 'auth_callback',
              user_id: session?.user?.id,
              metadata: {
                error_detail: error.stack,
                session_provider: session?.user?.app_metadata?.provider,
                event: event
              }
            });
          } catch (logError) {
            console.error('Failed to log error:', logError);
          }
          
          // Default to profile setup on error
          navigate('/profile');
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out in callback');
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
