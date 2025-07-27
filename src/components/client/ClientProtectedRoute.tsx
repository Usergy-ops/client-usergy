
import { ReactNode, useEffect } from 'react';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { Navigate } from 'react-router-dom';

interface ClientProtectedRouteProps {
  children: ReactNode;
}

export function ClientProtectedRoute({ children }: ClientProtectedRouteProps) {
  const { user, loading, isClientAccount, checkClientStatus } = useClientAuth();

  console.log('ClientProtectedRoute state:', { 
    user: !!user, 
    loading, 
    isClientAccount,
    userEmail: user?.email 
  });

  // Re-check client status when component mounts if user exists but isn't detected as client
  useEffect(() => {
    if (user && !isClientAccount && !loading) {
      console.log('Re-checking client status for user:', user.id);
      checkClientStatus();
    }
  }, [user, isClientAccount, loading, checkClientStatus]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="glass-card p-8">
          <div className="flex items-center space-x-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <div className="space-y-2">
              <span className="text-lg font-semibold">Verifying access...</span>
              <p className="text-sm text-muted-foreground">Please wait while we confirm your account</p>
            </div>
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="glass-card p-8 text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-4 text-foreground">Access Denied</h2>
          <p className="text-muted-foreground mb-6">
            This account is not registered as a client account. Please contact support if you believe this is an error.
          </p>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>Account:</strong> {user.email}
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Support:</strong> support@usergy.ai
            </p>
          </div>
        </div>
      </div>
    );
  }

  console.log('User has client account, rendering protected content');
  return <>{children}</>;
}
