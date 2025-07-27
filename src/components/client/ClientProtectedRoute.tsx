
import { ReactNode, useEffect } from 'react';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { useNavigate } from 'react-router-dom';

interface ClientProtectedRouteProps {
  children: ReactNode;
}

export function ClientProtectedRoute({ children }: ClientProtectedRouteProps) {
  const { user, loading } = useClientAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      console.log('No authenticated user, redirecting to home');
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

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

  if (user) {
    return <>{children}</>;
  }

  return null;
}
