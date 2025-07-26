import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Handle the OAuth callback
    const handleAuthStateChange = async (event: string, session: any) => {
      if (event === 'SIGNED_IN' && session) {
        // Check if user has a client account and profile completion
        try {
          // Check if user has a client account and profile completion
          const { data: profile } = await supabase
            .schema('client_workspace')
            .from('company_profiles')
            .select('onboarding_status')
            .eq('auth_user_id', session.user.id)
            .single();

          if (profile?.onboarding_status === 'complete') {
            navigate('/dashboard');
          } else {
            navigate('/profile');
          }
        } catch (error) {
          console.error('Error checking profile:', error);
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