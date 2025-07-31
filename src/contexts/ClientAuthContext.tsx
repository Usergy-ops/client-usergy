import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useErrorLogger } from '@/hooks/useErrorLogger';
import { ClientAccountDiagnostics } from '@/utils/clientAccountDiagnostics';
import { SimplifiedClientDiagnostics } from '@/utils/simplifiedClientDiagnostics';

interface ClientAuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isClientAccount: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  setSession: (session: Session | null) => void;
  waitForClientAccount: (userId: string, maxAttempts?: number) => Promise<boolean>;
  diagnoseAccount: (userId: string) => Promise<any>;
  repairAccount: (userId: string, userMetadata?: any) => Promise<boolean>;
  getAccountHealth: (userId: string) => Promise<any>;
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

export function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClientAccount, setIsClientAccount] = useState(false);
  const initializingRef = useRef(false);
  const { logAuthError } = useErrorLogger();

  // Enhanced account health check using simplified diagnostics
  const getAccountHealth = useCallback(async (userId: string) => {
    console.log(`Getting account health for user: ${userId}`);
    
    try {
      const health = await ClientAccountDiagnostics.validateClientAccountIntegrity(userId);
      console.log('Account health report:', health);
      return health;
    } catch (error) {
      console.error('Account health check failed:', error);
      await logAuthError(error, 'account_health_check_failed');
      return {
        userId,
        userExists: false,
        hasAccountType: false,
        accountType: null,
        hasCompanyProfile: false,
        isClientVerified: false,
        issues: ['Health check failed'],
        recommendations: ['Retry health check'],
        rawData: {}
      };
    }
  }, [logAuthError]);

  // Simplified account repair function
  const repairAccount = useCallback(async (userId: string, userMetadata?: any): Promise<boolean> => {
    console.log(`Attempting to repair account for user: ${userId}`);
    
    try {
      const repairResult = await ClientAccountDiagnostics.repairClientAccount(userId, userMetadata);
      
      if (repairResult.success) {
        console.log('Account repair successful');
        // Re-verify client status after repair
        const isClient = await waitForClientAccount(userId, 5);
        return isClient;
      } else {
        console.error('Account repair failed:', repairResult.error);
        return false;
      }
    } catch (error) {
      console.error('Account repair exception:', error);
      await logAuthError(error, 'account_repair_exception');
      return false;
    }
  }, []);

  // Simplified diagnose account function
  const diagnoseAccount = useCallback(async (userId: string) => {
    console.log(`Diagnosing account for user: ${userId}`);
    
    try {
      const diagnosticResult = await ClientAccountDiagnostics.runComprehensiveDiagnostic(userId);
      
      if (diagnosticResult.success) {
        console.log('Account diagnosis result:', diagnosticResult.data);
        return diagnosticResult.data;
      } else {
        console.error('Diagnosis failed:', diagnosticResult.error);
        return {
          user_exists: false,
          error: diagnosticResult.error,
          is_client_account_result: false
        };
      }
    } catch (error) {
      console.error('Account diagnosis failed:', error);
      await logAuthError(error, 'diagnose_account_exception_simplified');
      return {
        user_exists: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        is_client_account_result: false
      };
    }
  }, [logAuthError]);

  // Simplified wait for client account with better error handling
  const waitForClientAccount = useCallback(async (userId: string, maxAttempts = 10): Promise<boolean> => {
    console.log(`Simplified wait: Starting client account verification for user: ${userId}`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`Simplified wait: Attempt ${attempt}/${maxAttempts} - Checking client status...`);
        
        // Use simplified client check
        const isClient = await SimplifiedClientDiagnostics.isClientAccount(userId);

        if (isClient) {
          console.log(`Simplified wait: SUCCESS! Client account confirmed on attempt ${attempt}`);
          setIsClientAccount(true);
          return true;
        } else {
          console.log(`Simplified wait: Attempt ${attempt} - Not yet a client account, waiting...`);
          
          // On first few attempts, try to ensure account type is assigned
          if (attempt <= 3) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) {
              console.log('Ensuring account type is assigned...');
              await ClientAccountDiagnostics.repairClientAccount(userId);
            }
          }
        }

        // Progressive delay
        if (attempt < maxAttempts) {
          const delay = Math.min(1000 + (attempt * 500), 3000);
          console.log(`Simplified wait: Waiting ${delay}ms before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error(`Simplified wait: Exception on attempt ${attempt}:`, error);
        await logAuthError(error, `simplified_check_client_status_exception_${attempt}`);
        
        if (attempt === maxAttempts) {
          console.error('Simplified wait: Final attempt failed with exception');
          return false;
        }
      }
    }

    console.log('Simplified wait: All attempts exhausted - client account not confirmed');
    setIsClientAccount(false);
    return false;
  }, [logAuthError]);

  // Enhanced session initialization
  const initializeAuth = useCallback(async () => {
    if (initializingRef.current) {
      console.log('AuthContext: Already initializing, skipping.');
      return;
    }
    
    initializingRef.current = true;
    console.log('AuthContext: Initializing enhanced authentication...');

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('AuthContext: Error getting initial session:', error);
        await logAuthError(error, 'initialize_auth_get_session_enhanced');
        setLoading(false);
        return;
      }

      if (session?.user) {
        console.log(`AuthContext: Found existing session for: ${session.user.email}`);
        setSession(session);
        setUser(session.user);
        
        // Give more time for database operations to complete
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const isClient = await waitForClientAccount(session.user.id, 8);
        console.log(`AuthContext: Initial client status check: ${isClient}`);
      } else {
        console.log('AuthContext: No existing session found.');
        setSession(null);
        setUser(null);
        setIsClientAccount(false);
      }
    } catch (error) {
      console.error('AuthContext: Exception during enhanced auth initialization:', error);
      await logAuthError(error, 'initialize_auth_exception_enhanced');
    } finally {
      setLoading(false);
      initializingRef.current = false;
      console.log('AuthContext: Enhanced initialization complete.');
    }
  }, [waitForClientAccount, logAuthError]);

  // Enhanced auth state change handler
  const handleAuthStateChange = useCallback(async (event: string, newSession: Session | null) => {
    console.log(`Enhanced Auth: State changed - Event: ${event}, User: ${newSession?.user?.email}`);

    setSession(newSession);
    setUser(newSession?.user ?? null);

    try {
      if (event === 'SIGNED_IN' && newSession?.user) {
        console.log(`Enhanced Auth: User signed in (${newSession.user.id}), enhanced account setup...`);
        
        // Give more time for database triggers and operations
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const isClient = await waitForClientAccount(newSession.user.id, 12);
        console.log(`Enhanced Auth: Final client status after enhanced sign in: ${isClient}`);
        
      } else if (event === 'SIGNED_OUT') {
        console.log('Enhanced Auth: User signed out, clearing state');
        setIsClientAccount(false);
        
      } else if (event === 'TOKEN_REFRESHED' && newSession?.user) {
        console.log(`Enhanced Auth: Token refreshed for ${newSession.user.email}, verifying client status...`);
        const isClient = await waitForClientAccount(newSession.user.id, 3);
        console.log(`Enhanced Auth: Client status after token refresh: ${isClient}`);
      }
    } catch (error) {
      console.error('Enhanced Auth: Error in auth state change handler:', error);
      await logAuthError(error, `enhanced_auth_state_change_${event}`);
    }
  }, [waitForClientAccount, logAuthError]);

  useEffect(() => {
    console.log('AuthContext: Mounting and setting up auth listener.');
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      handleAuthStateChange(event, session);
    });

    initializeAuth();

    return () => {
      console.log('AuthContext: Unmounting and unsubscribing from auth listener.');
      subscription.unsubscribe();
    };
  }, [initializeAuth, handleAuthStateChange]);

  const refreshSession = useCallback(async () => {
    console.log('AuthContext: Manually refreshing session...');
    
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('AuthContext: Error refreshing session:', error);
        await logAuthError(error, 'refresh_session');
        return;
      }

      console.log(`AuthContext: Session refreshed, new user: ${session?.user?.email}`);
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const isClient = await waitForClientAccount(session.user.id, 3);
        console.log(`AuthContext: Client status after manual refresh: ${isClient}`);
      } else {
        setIsClientAccount(false);
      }
    } catch (error) {
      console.error('AuthContext: Exception refreshing session:', error);
      await logAuthError(error, 'refresh_session_exception');
    }
  }, [waitForClientAccount, logAuthError]);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Signing in with email:', email);
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('Sign in error:', error);
        await logAuthError(error, 'sign_in_password');
        return { error };
      }

      console.log('Sign in successful');
      return { error: null };
    } catch (error) {
      console.error('Sign in exception:', error);
      await logAuthError(error, 'sign_in_exception');
      return { error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      console.log('Initiating Google OAuth...');
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (error) {
        console.error('Google OAuth error:', error);
        await logAuthError(error, 'google_oauth');
        return { error };
      }

      console.log('Google OAuth initiated successfully');
      return { error: null };
    } catch (error) {
      console.error('Google OAuth exception:', error);
      await logAuthError(error, 'google_oauth_exception');
      return { error: { message: 'Failed to sign in with Google' } };
    }
  };

  const signOut = async () => {
    try {
      console.log('Signing out...');
      
      // Clear state first
      setUser(null);
      setSession(null);
      setIsClientAccount(false);
      
      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Sign out error:', error);
        await logAuthError(error, 'sign_out');
      }
      
      // Force redirect to home
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out exception:', error);
      await logAuthError(error, 'sign_out_exception');
      // Still redirect on error
      window.location.href = '/';
    }
  };

  const value = {
    user,
    session,
    loading,
    isClientAccount,
    signIn,
    signInWithGoogle,
    signOut,
    refreshSession,
    setSession,
    waitForClientAccount,
    diagnoseAccount,
    repairAccount,
    getAccountHealth,
  };

  return (
    <ClientAuthContext.Provider value={value}>
      {children}
    </ClientAuthContext.Provider>
  );
}

export function useClientAuth() {
  const context = useContext(ClientAuthContext);
  if (context === undefined) {
    throw new Error('useClientAuth must be used within a ClientAuthProvider');
  }
  return context;
}
