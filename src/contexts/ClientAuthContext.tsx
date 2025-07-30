import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useErrorLogger } from '@/hooks/useErrorLogger';

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
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

export function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClientAccount, setIsClientAccount] = useState(false);
  const initializingRef = useRef(false);
  const { logAuthError } = useErrorLogger();

  // Enhanced diagnose account function using the new comprehensive diagnostic
  const diagnoseAccount = useCallback(async (userId: string) => {
    console.log(`Diagnosing account for user: ${userId}`);
    
    try {
      const { data: result, error } = await supabase.rpc('diagnose_client_account_comprehensive', {
        user_id_param: userId
      });

      if (error) {
        console.error('Error in diagnose account:', error);
        await logAuthError(error, 'diagnose_account_rpc');
        return {
          user_exists: false,
          error: error.message,
          is_client_account: false
        };
      }

      console.log('Account diagnosis result:', result);
      return result;
      
    } catch (error) {
      console.error('Account diagnosis failed:', error);
      await logAuthError(error, 'diagnose_account_exception');
      return {
        user_exists: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        is_client_account: false
      };
    }
  }, [logAuthError]);

  // Enhanced wait for client account with better error handling
  const waitForClientAccount = useCallback(async (userId: string, maxAttempts = 8): Promise<boolean> => {
    console.log(`Waiting for client account creation for user: ${userId}`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${maxAttempts} to verify client account...`);
        
        const { data: isClient, error } = await supabase.rpc('is_client_account', {
          user_id_param: userId
        });

        if (error) {
          console.error('Error checking client status:', error);
          await logAuthError(error, `check_client_status_attempt_${attempt}`);
          
          if (attempt === maxAttempts) {
            return false;
          }
        } else if (isClient) {
          console.log('Client account confirmed!');
          setIsClientAccount(true);
          return true;
        }

        // Progressive delay with shorter initial waits
        if (attempt < maxAttempts) {
          const delay = Math.min(attempt * 500, 2000); // 500ms, 1s, 1.5s, 2s max
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error(`Exception on attempt ${attempt}:`, error);
        await logAuthError(error, `check_client_status_exception_${attempt}`);
        if (attempt === maxAttempts) {
          return false;
        }
      }
    }

    console.log('Client account not found after all attempts');
    setIsClientAccount(false);
    return false;
  }, [logAuthError]);

  // Enhanced client account creation with the new unified function
  const ensureClientAccount = useCallback(async (userId: string, userMetadata: any) => {
    console.log('Ensuring client account for user:', userId, userMetadata);

    try {
      const { data: result, error } = await supabase.rpc('create_client_account_unified', {
        user_id_param: userId,
        company_name_param: userMetadata?.companyName || userMetadata?.company_name || 'My Company',
        first_name_param: userMetadata?.contactFirstName ||
          userMetadata?.first_name ||
          userMetadata?.full_name?.split(' ')[0] || '',
        last_name_param: userMetadata?.contactLastName ||
          userMetadata?.last_name ||
          userMetadata?.full_name?.split(' ').slice(1).join(' ') || ''
      });

      if (error) {
        console.error('Error ensuring client account:', error);
        await logAuthError(error, 'create_client_account_unified');
        return false;
      }

      if (result?.success) {
        console.log('Client account ensured successfully:', result);
        return true;
      } else {
        console.error('Client account creation failed:', result?.error);
        await logAuthError(new Error(result?.error || 'Unknown error'), 'create_client_account_failed');
        return false;
      }
    } catch (error) {
      console.error('Exception ensuring client account:', error);
      await logAuthError(error, 'create_client_account_exception');
      return false;
    }
  }, [logAuthError]);

  // Enhanced session initialization
  const initializeAuth = useCallback(async () => {
    if (initializingRef.current) {
      console.log('AuthContext: Already initializing, skipping.');
      return;
    }
    
    initializingRef.current = true;
    console.log('AuthContext: Initializing authentication...');

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('AuthContext: Error getting initial session:', error);
        await logAuthError(error, 'initialize_auth_get_session');
        setLoading(false);
        return;
      }

      if (session?.user) {
        console.log(`AuthContext: Found existing session for: ${session.user.email}`);
        setSession(session);
        setUser(session.user);
        
        // Give the database trigger some time to process if this is a new user
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const isClient = await waitForClientAccount(session.user.id, 5);
        console.log(`AuthContext: Initial client status check: ${isClient}`);
      } else {
        console.log('AuthContext: No existing session found.');
        setSession(null);
        setUser(null);
        setIsClientAccount(false);
      }
    } catch (error) {
      console.error('AuthContext: Exception during auth initialization:', error);
      await logAuthError(error, 'initialize_auth_exception');
    } finally {
      setLoading(false);
      initializingRef.current = false;
      console.log('AuthContext: Initialization complete.');
    }
  }, [waitForClientAccount, logAuthError]);

  // Enhanced auth state change handler
  const handleAuthStateChange = useCallback(async (event: string, newSession: Session | null) => {
    console.log(`AuthContext: Auth state changed - Event: ${event}, User: ${newSession?.user?.email}`);

    setSession(newSession);
    setUser(newSession?.user ?? null);

    try {
      if (event === 'SIGNED_IN' && newSession?.user) {
        console.log(`AuthContext: User signed in (${newSession.user.id}), waiting for account setup...`);
        
        // Give the database trigger time to process
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const isClient = await waitForClientAccount(newSession.user.id, 8);
        console.log(`AuthContext: Client status after sign in: ${isClient}`);
        
      } else if (event === 'SIGNED_OUT') {
        console.log('AuthContext: User signed out.');
        setIsClientAccount(false);
        
      } else if (event === 'TOKEN_REFRESHED' && newSession?.user) {
        console.log(`AuthContext: Token refreshed for ${newSession.user.email}, verifying client status...`);
        const isClient = await waitForClientAccount(newSession.user.id, 3);
        console.log(`AuthContext: Client status after token refresh: ${isClient}`);
      }
    } catch (error) {
      console.error('AuthContext: Error in auth state change handler:', error);
      await logAuthError(error, `auth_state_change_${event}`);
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
