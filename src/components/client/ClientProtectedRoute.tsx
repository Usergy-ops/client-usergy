
import { ReactNode, useEffect } from 'react';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { Navigate, useLocation } from 'react-router-dom';

interface ClientProtectedRouteProps {
  children: ReactNode;
}

export function ClientProtectedRoute({ children }: ClientProtectedRouteProps) {
  const { user, session, loading, isClientAccount } = useClientAuth();
  const location = useLocation();

  // Enhanced loading state with better UX
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="glass-card p-8 text-center">
          <div className="flex items-center justify-center space-x-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <div>
              <span className="text-lg font-semibold">Loading...</span>
              <p className="text-sm text-muted-foreground mt-1">Verifying your account</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Enhanced authentication checks
  if (!user || !session) {
    console.log('ClientProtectedRoute: No user or session, redirecting to home');
    return <Navigate to="/" replace />;
  }

  // Check if session is expired
  if (session.expires_at && session.expires_at < Date.now() / 1000) {
    console.log('ClientProtectedRoute: Session expired, redirecting to home');
    return <Navigate to="/" replace />;
  }

  // Check if user is a client account
  if (!isClientAccount) {
    console.log('ClientProtectedRoute: Not a client account, redirecting to home');
    return <Navigate to="/" replace />;
  }

  // All checks passed, render protected content
  return <>{children}</>;
}
