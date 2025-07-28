
import { ReactNode, useEffect, useState } from 'react';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { useNavigate } from 'react-router-dom';

interface ClientProtectedRouteProps {
  children: ReactNode;
}

export function ClientProtectedRoute({ children }: ClientProtectedRouteProps) {
  const { user, loading, isClientAccount, checkClientStatus } = useClientAuth();
  const navigate = useNavigate();
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const verifyAccess = async () => {
      if (loading || isVerifying) return;

      if (!user) {
        console.log('No authenticated user, redirecting to home');
        navigate('/', { replace: true });
        return;
      }

      // If we already know the user is a client, allow access
      if (isClientAccount) {
        console.log('User is confirmed client, allowing access');
        return;
      }

      // Single verification attempt
      setIsVerifying(true);
      try {
        console.log('Verifying client account status...');
        const isClient = await checkClientStatus(user.id);

        if (isClient) {
          console.log('User verified as client');
          // Context will be updated by checkClientStatus
        } else {
          console.log('User not verified as client, redirecting to home');
          navigate('/', { replace: true });
        }
      } catch (error) {
        console.error('Exception verifying client status:', error);
        navigate('/', { replace: true });
      } finally {
        setIsVerifying(false);
      }
    };

    verifyAccess();
  }, [user, loading, isClientAccount, navigate, checkClientStatus]);

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
