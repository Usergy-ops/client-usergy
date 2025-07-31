
import { useClientAuth } from '@/contexts/ClientAuthContext';

export function useAuthDebug(componentName: string) {
  const { user, session, loading, isClientAccount } = useClientAuth();

  // Log authentication state for debugging
  console.log(`[${componentName}] Auth state:`, {
    user: user?.id,
    session: !!session,
    loading,
    isClientAccount
  });

  return {
    user,
    session,
    loading,
    isClientAccount,
    isAuthenticated: !loading && !!user && !!session
  };
}
