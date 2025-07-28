
import { ReactNode, useEffect } from 'react';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { useNavigate } from 'react-router-dom';

interface ClientProtectedRouteProps {
  children: ReactNode;
}

export function ClientProtectedRoute({ children }: ClientProtectedRouteProps) {
  const { user, loading, isClientAccount, accountCreationStatus } = useClientAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !accountCreationStatus.isCreating) {
      if (!user) {
        console.log('No authenticated user, redirecting to home');
        navigate('/', { replace: true });
      } else if (!isClientAccount && !accountCreationStatus.isComplete) {
        console.log('User exists but not a client account and creation not complete, redirecting to home');
        navigate('/', { replace: true });
      }
    }
  }, [user, loading, isClientAccount, accountCreationStatus, navigate]);

  if (loading || accountCreationStatus.isCreating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="glass-card p-8">
          <div className="flex items-center space-x-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <div className="space-y-2">
              <span className="text-lg font-semibold">
                {accountCreationStatus.isCreating ? 'Setting up your account...' : 'Loading...'}
              </span>
              <p className="text-sm text-muted-foreground">
                {accountCreationStatus.isCreating ? 'Please wait while we prepare your dashboard' : 'Please wait'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (accountCreationStatus.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="glass-card p-8 text-center">
          <div className="text-red-500 mb-4 text-lg font-semibold">Account Setup Failed</div>
          <p className="text-sm text-muted-foreground mb-4">{accountCreationStatus.error}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (user && (isClientAccount || accountCreationStatus.isComplete)) {
    return <>{children}</>;
  }

  return null;
}
