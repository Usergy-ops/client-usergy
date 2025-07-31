
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { checkProfileCompletion } from '@/utils/profileValidation';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isClientAccount } = useClientAuth();
  const [status, setStatus] = useState('processing');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Handle the auth callback
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          setStatus('error');
          return;
        }

        if (data.session && data.session.user) {
          setStatus('success');
          
          // Check if user is a client account and profile completion
          if (isClientAccount) {
            try {
              const profileCheck = await checkProfileCompletion(data.session.user.id);
              
              if (profileCheck.isComplete) {
                navigate('/dashboard', { replace: true });
              } else {
                // For now, redirect to dashboard even if profile is incomplete
                // This prevents users from being stuck in redirect loops
                console.log('Profile incomplete, but redirecting to dashboard to prevent loops');
                navigate('/dashboard', { replace: true });
              }
            } catch (error) {
              console.error('Profile check error during callback:', error);
              // Default to dashboard if check fails
              navigate('/dashboard', { replace: true });
            }
          } else {
            // If not a client account, redirect to dashboard
            navigate('/dashboard', { replace: true });
          }
        } else {
          console.log('No session found in auth callback');
          navigate('/', { replace: true });
        }
      } catch (error) {
        console.error('Auth callback exception:', error);
        setStatus('error');
      }
    };

    handleAuthCallback();
  }, [navigate, isClientAccount]);

  const getStatusMessage = () => {
    switch (status) {
      case 'processing':
        return 'Processing authentication...';
      case 'success':
        return 'Authentication successful! Redirecting...';
      case 'error':
        return 'Authentication failed. Redirecting to home...';
      default:
        return 'Processing...';
    }
  };

  if (status === 'error') {
    setTimeout(() => navigate('/', { replace: true }), 3000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="glass-card p-8 text-center max-w-md">
        <div className="flex items-center justify-center space-x-4 mb-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <div>
            <h1 className="text-xl font-semibold">Authentication</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {getStatusMessage()}
            </p>
          </div>
        </div>
        
        {user && (
          <div className="text-sm text-muted-foreground">
            Welcome, {user.email}
          </div>
        )}
      </div>
    </div>
  );
}
