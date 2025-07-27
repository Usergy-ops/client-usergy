
import { ReactNode } from 'react';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { Navigate } from 'react-router-dom';

interface ClientProtectedRouteProps {
  children: ReactNode;
}

export function ClientProtectedRoute({ children }: ClientProtectedRouteProps) {
  const { user, loading, isClientAccount } = useClientAuth();

  console.log('ClientProtectedRoute state:', { user: !!user, loading, isClientAccount });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="glass-card p-8">
          <div className="flex items-center space-x-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="text-lg">Verifying access...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    console.log('No user found, redirecting to welcome page');
    return <Navigate to="/" replace />;
  }

  if (!isClientAccount) {
    console.log('User is not a client account, showing access denied');
    // This will trigger redirect to user.usergy.ai in the context
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="glass-card p-8 text-center">
          <h2 className="text-xl font-semibold mb-4">Access Denied</h2>
          <p className="text-muted-foreground mb-4">
            This account is not registered as a client account.
          </p>
          <p className="text-sm text-muted-foreground">
            Redirecting to user portal...
          </p>
        </div>
      </div>
    );
  }

  console.log('User has client account, rendering protected content');
  return <>{children}</>;
}
