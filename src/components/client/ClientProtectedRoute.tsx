
import { ReactNode, useEffect } from 'react';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { useNavigate } from 'react-router-dom';

interface ClientProtectedRouteProps {
  children: ReactNode;
}

export function ClientProtectedRoute({ children }: ClientProtectedRouteProps) {
  const { user, loading, isClientAccount, refreshSession } = useClientAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      console.log('No authenticated user, redirecting to home');
      navigate('/', { replace: true });
      return;
    }

    if (!loading && user && !isClientAccount) {
      console.log('User exists but not a client account, refreshing session and checking again');
      
      // Try to refresh session and check again
      refreshSession().then(() => {
        // Give a small delay for the refresh to complete
        setTimeout(() => {
          // If still not a client account after refresh, redirect
          if (!isClientAccount) {
            console.log('Still not a client account after refresh, redirecting to home');
            navigate('/', { replace: true });
          }
        }, 1000);
      });
    }
  }, [user, loading, isClientAccount, navigate, refreshSession]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="glass-card p-8">
          <div className="flex items-center space-x-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <div className="space-y-2">
              <span className="text-lg font-semibold">Loading...</span>
              <p className="text-sm text-muted-foreground">Please wait</p>
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
