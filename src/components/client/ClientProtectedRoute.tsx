
import { ReactNode, useEffect } from 'react';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { useNavigate } from 'react-router-dom';

interface ClientProtectedRouteProps {
  children: ReactNode;
}

export function ClientProtectedRoute({ children }: ClientProtectedRouteProps) {
  const { user, loading, isClientAccount } = useClientAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        console.log('ClientProtectedRoute: No user, redirecting to home');
        navigate('/', { replace: true });
      } else if (!isClientAccount) {
        console.log('ClientProtectedRoute: Not a client account, redirecting to home');
        navigate('/', { replace: true });
      }
    }
  }, [user, loading, isClientAccount, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="glass-card p-8">
          <div className="flex items-center space-x-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="text-lg font-semibold">Loading...</span>
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
