import { ReactNode, useEffect, useState } from 'react';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { Navigate } from 'react-router-dom';
import { checkProfileCompletion } from '@/utils/profileValidation';

interface EnhancedClientProtectedRouteProps {
  children: ReactNode;
}

export function EnhancedClientProtectedRoute({ children }: EnhancedClientProtectedRouteProps) {
  const { user, session, loading, isClientAccount } = useClientAuth();
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    const performProfileCheck = async () => {
      if (!user || !isClientAccount) {
        setCheckingProfile(false);
        return;
      }

      try {
        console.log('Checking profile completion for user:', user.id);
        
        const result = await checkProfileCompletion(user.id);
        
        if (result.error) {
          console.error('Profile completion check error:', result.error);
          setProfileError(result.error);
          setIsProfileComplete(false);
        } else {
          console.log('Profile completion check result:', result.isComplete);
          setIsProfileComplete(result.isComplete);
        }
      } catch (error) {
        console.error('Exception in profile completion check:', error);
        setProfileError('Failed to check profile completion');
        setIsProfileComplete(false);
      } finally {
        setCheckingProfile(false);
      }
    };

    if (!loading && user && isClientAccount) {
      performProfileCheck();
    } else if (!loading) {
      setCheckingProfile(false);
    }
  }, [user, isClientAccount, loading]);

  // Enhanced loading state
  if (loading || checkingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="glass-card p-8 text-center">
          <div className="flex items-center justify-center space-x-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <div>
              <span className="text-lg font-semibold">Loading...</span>
              <p className="text-sm text-muted-foreground mt-1">Verifying your access</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Enhanced authentication checks
  if (!user || !session) {
    console.log('EnhancedClientProtectedRoute: No user or session, redirecting to home');
    return <Navigate to="/" replace />;
  }

  // Check if session is expired
  if (session.expires_at && session.expires_at < Date.now() / 1000) {
    console.log('EnhancedClientProtectedRoute: Session expired, redirecting to home');
    return <Navigate to="/" replace />;
  }

  // Check if user is a client account
  if (!isClientAccount) {
    console.log('EnhancedClientProtectedRoute: Not a client account, redirecting to home');
    return <Navigate to="/" replace />;
  }

  // Check if profile is complete
  if (!isProfileComplete) {
    console.log('EnhancedClientProtectedRoute: Profile incomplete, redirecting to profile setup');
    if (profileError) {
      console.log('Profile check error:', profileError);
    }
    return <Navigate to="/profile" replace />;
  }

  // All checks passed, render protected content
  return <>{children}</>;
}
