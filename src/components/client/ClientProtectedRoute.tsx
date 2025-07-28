
import { ReactNode, useEffect, useState } from 'react';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface ClientProtectedRouteProps {
  children: ReactNode;
}

export function ClientProtectedRoute({ children }: ClientProtectedRouteProps) {
  const { user, loading, isClientAccount } = useClientAuth();
  const navigate = useNavigate();
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      if (loading || isVerifying) return;

      if (!user) {
        console.log('No authenticated user, redirecting to home');
        navigate('/', { replace: true });
        return;
      }

      // If we already know the user is a client, we're good
      if (isClientAccount) {
        console.log('User is confirmed client, allowing access');
        return;
      }

      // Brief check without polling
      setIsVerifying(true);
      try {
        console.log('Verifying client account status...');
        // Just check once - no polling here
        const { data: isClient } = await supabase.rpc('is_client_account', {
          user_id_param: user.id
        });

        if (Boolean(isClient)) {
          console.log('User verified as client');
          // The context will update isClientAccount through its own mechanisms
        } else {
          console.log('User not verified as client, redirecting to home');
          navigate('/', { replace: true });
        }
      } catch (error) {
        console.error('Error verifying client status:', error);
        navigate('/', { replace: true });
      } finally {
        setIsVerifying(false);
      }
    };

    checkAccess();
  }, [user, loading, isClientAccount, navigate]);

  if (loading || isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="glass-card p-8">
          <div className="flex items-center space-x-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <div className="space-y-2">
              <span className="text-lg font-semibold">
                {loading ? 'Loading...' : 'Verifying access...'}
              </span>
              <p className="text-sm text-muted-foreground">
                Please wait
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (user && isClientAccount) {
    return <>{children}</>;
  }

  return null;
}
