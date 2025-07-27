// src/pages/AuthCallback.tsx
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
        // Get the session from Supabase
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          console.error('No session found:', sessionError);
          setError('Authentication failed. Please try again.');
          setTimeout(() => navigate('/'), 3000);
          return;
        }

        console.log('Session found for user:', session.user.id);
        
        // Wait a moment for database triggers to complete
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Check if user has client account
        const { data: accountType } = await supabase
          .from('account_types')
          .select('account_type')
          .eq('auth_user_id', session.user.id)
          .eq('account_type', 'client')
          .maybeSingle();
        
        if (!accountType) {
          // For Google users, create client account
          const isGoogleUser = session.user.app_metadata?.provider === 'google';
          
          if (isGoogleUser) {
            console.log('Creating client account for Google user');
            
            const { error: createError } = await supabase
              .from('account_types')
              .insert({
                auth_user_id: session.user.id,
                account_type: 'client'
              });
            
            if (createError) {
              console.error('Failed to create client account:', createError);
              setError('Failed to create client account. Please contact support.');
              setTimeout(() => navigate('/'), 3000);
              return;
            }
            
            // Also create profile
            await supabase
              .from('client_workspace.company_profiles')
              .insert({
                auth_user_id: session.user.id,
                contact_first_name: session.user.user_metadata?.full_name?.split(' ')[0] || '',
                contact_last_name: session.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
                company_name: ''
              });
          } else {
            // Not a client, redirect to user portal
            window.location.href = 'https://user.usergy.ai';
            return;
          }
        }
        
        // Check if profile is complete
        const { data: profile } = await supabase
          .from('client_workspace.company_profiles')
          .select('onboarding_status')
          .eq('auth_user_id', session.user.id)
          .maybeSingle();
        
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
            <p className="text-lg">Processing authentication...</p>
          </>
        )}
      </div>
    </div>
  );
}