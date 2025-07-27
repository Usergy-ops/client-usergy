
import { ReactNode, useEffect } from 'react';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

interface ClientProtectedRouteProps {
  children: ReactNode;
}

export function ClientProtectedRoute({ children }: ClientProtectedRouteProps) {
  const { user, loading, isClientAccount } = useClientAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only redirect if we're not loading and there's no authenticated user
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

  // If user is authenticated, show the protected content
  // Remove the isClientAccount check since we want to allow access after OTP verification
  if (user) {
    return <>{children}</>;
  }

  // If no user and not loading, the useEffect will handle the redirect
  return null;
}
