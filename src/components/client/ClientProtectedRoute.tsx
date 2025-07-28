
import { ReactNode } from 'react';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { Navigate } from 'react-router-dom';

interface ClientProtectedRouteProps {
  children: ReactNode;
}

export function ClientProtectedRoute({ children }: ClientProtectedRouteProps) {
  const { user, loading, isClientAccount } = useClientAuth();

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

  // Not authenticated
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Authenticated but not a client account
  if (!isClientAccount) {
    return <Navigate to="/" replace />;
  }

  // Authenticated and is a client
  return <>{children}</>;
}
