
import { ReactNode, useEffect, useState } from 'react';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface EnhancedClientProtectedRouteProps {
  children: ReactNode;
}

export function EnhancedClientProtectedRoute({ children }: EnhancedClientProtectedRouteProps) {
  const { user, session, loading, isClientAccount } = useClientAuth();
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);

  useEffect(() => {
    const checkProfileCompletion = async () => {
      if (!user || !isClientAccount) {
        setCheckingProfile(false);
        return;
      }

      try {
        // Check if profile is complete in client_workspace.company_profiles
        const { data: profile, error } = await supabase
          .from('client_workspace.company_profiles')
          .select('company_name, industry, company_size, contact_role, company_country, company_city, company_timezone, onboarding_status')
          .eq('auth_user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error checking profile completion:', error);
          setIsProfileComplete(false);
        } else if (profile) {
          // Check if all required fields are completed
          const requiredFields = [
            'company_name',
            'industry', 
            'company_size',
            'contact_role',
            'company_country',
            'company_city',
            'company_timezone'
          ];
          
          const isComplete = requiredFields.every(field => 
            profile?.[field as keyof typeof profile] && 
            profile[field as keyof typeof profile] !== ''
          ) && profile?.onboarding_status === 'completed';
          
          console.log('Profile completion check:', { profile, isComplete });
          setIsProfileComplete(isComplete);
        } else {
          // No profile found
          setIsProfileComplete(false);
        }
      } catch (error) {
        console.error('Exception in profile completion check:', error);
        setIsProfileComplete(false);
      } finally {
        setCheckingProfile(false);
      }
    };

    if (!loading && user && isClientAccount) {
      checkProfileCompletion();
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
    return <Navigate to="/profile" replace />;
  }

  // All checks passed, render protected content
  return <>{children}</>;
}
