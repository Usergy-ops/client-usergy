
import { useEffect } from 'react';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { useLocation } from 'react-router-dom';

export function useAuthDebug(componentName: string) {
  const { user, session, loading, isClientAccount } = useClientAuth();
  const location = useLocation();

  useEffect(() => {
    const authState = {
      route: location.pathname,
      hasUser: !!user,
      userEmail: user?.email,
      userId: user?.id,
      hasSession: !!session,
      sessionExpiry: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
      sessionValid: session?.expires_at ? session.expires_at > Date.now() / 1000 : false,
      isClientAccount,
      loading,
      timestamp: new Date().toISOString()
    };

    console.log(`[${componentName}] Auth Debug:`, authState);
    
    // Log warnings for potential issues
    if (user && !session) {
      console.warn(`[${componentName}] User exists but no session - potential auth issue`);
    }
    
    if (session && session.expires_at && session.expires_at < Date.now() / 1000) {
      console.warn(`[${componentName}] Session expired - needs refresh`);
    }
    
    if (user && session && !isClientAccount) {
      console.warn(`[${componentName}] User authenticated but not client account`);
    }

  }, [user, session, loading, isClientAccount, location.pathname, componentName]);

  return {
    user,
    session,
    loading,
    isClientAccount,
    isAuthenticated: !!user && !!session && isClientAccount && 
      (!session.expires_at || session.expires_at > Date.now() / 1000)
  };
}
