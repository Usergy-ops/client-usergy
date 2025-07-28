
import { useEffect } from 'react';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { useLocation } from 'react-router-dom';

export function useAuthDebug(componentName: string) {
  const { user, session, loading, isClientAccount } = useClientAuth();
  const location = useLocation();

  useEffect(() => {
    console.log(`[${componentName}] Auth Debug:`, {
      route: location.pathname,
      hasUser: !!user,
      userEmail: user?.email,
      hasSession: !!session,
      sessionExpiry: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
      isClientAccount,
      loading,
      timestamp: new Date().toISOString()
    });
  }, [user, session, loading, isClientAccount, location.pathname, componentName]);

  return {
    user,
    session,
    loading,
    isClientAccount,
    isAuthenticated: !!user && !!session && isClientAccount
  };
}
