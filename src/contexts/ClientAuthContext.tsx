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

  // Enhanced diagnose account function using the comprehensive diagnostic
  const diagnoseAccount = useCallback(async (userId: string) => {
    console.log(`Enhanced Diagnosing account for user: ${userId}`);
    
    try {
      const { data: result, error } = await supabase.rpc('diagnose_client_account_comprehensive', {
        user_id_param: userId
      });

      if (error) {
        console.error('Error in enhanced diagnose account:', error);
        await logAuthError(error, 'diagnose_account_rpc_enhanced');
        return {
          user_exists: false,
          error: error.message,
          is_client_account_result: false
        };
      }

      console.log('Enhanced account diagnosis result:', result);
      return result;
      
    } catch (error) {
      console.error('Enhanced account diagnosis failed:', error);
      await logAuthError(error, 'diagnose_account_exception_enhanced');
      return {
        user_exists: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        is_client_account_result: false
      };
    }
  }, [logAuthError]);

  // Enhanced wait for client account with RLS-aware checks
  const waitForClientAccount = useCallback(async (userId: string, maxAttempts = 10): Promise<boolean> => {
    console.log(`Enhanced wait: Starting RLS-aware client account verification for user: ${userId}`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`Enhanced wait: Attempt ${attempt}/${maxAttempts} - Checking client status with RLS...`);
        
        const { data: isClient, error } = await supabase.rpc('is_client_account', {
          user_id_param: userId
        });

        if (error) {
          console.error(`Enhanced wait: RLS Error on attempt ${attempt}:`, error);
          await logAuthError(error, `enhanced_check_client_status_rls_attempt_${attempt}`);
          
          // Continue trying even on errors, but log them
          if (attempt === maxAttempts) {
            console.error('Enhanced wait: All RLS attempts failed with errors');
            return false;
          }
        } else if (isClient) {
          console.log(`Enhanced wait: SUCCESS! RLS-verified client account confirmed on attempt ${attempt}`);
          setIsClientAccount(true);
          return true;
        } else {
          console.log(`Enhanced wait: Attempt ${attempt} - Not yet a client account in RLS context, waiting...`);
        }

        // Progressive delay with better timing for RLS operations
        if (attempt < maxAttempts) {
          const delay = Math.min(1500 + (attempt * 750), 4000); // Start at 2.25s, max 4s for RLS
          console.log(`Enhanced wait: Waiting ${delay}ms before next RLS attempt...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error(`Enhanced wait: RLS Exception on attempt ${attempt}:`, error);
        await logAuthError(error, `enhanced_check_client_status_rls_exception_${attempt}`);
        
        if (attempt === maxAttempts) {
          console.error('Enhanced wait: Final RLS attempt failed with exception');
          return false;
        }
      }
    }

    console.log('Enhanced wait: All RLS attempts exhausted - client account not confirmed');
    setIsClientAccount(false);
    return false;
  }, [logAuthError]);

  // Enhanced session initialization with RLS support
  const initializeAuth = useCallback(async () => {
    if (initializingRef.current) {
      console.log('AuthContext: Already initializing, skipping.');
      return;
    }
    
    initializingRef.current = true;
    console.log('AuthContext: Initializing enhanced authentication with RLS support...');

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
        
        // Give the RLS policies and database triggers more time to process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const isClient = await waitForClientAccount(session.user.id, 8);
        console.log(`AuthContext: Initial RLS-verified client status check: ${isClient}`);
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

  // Enhanced auth state change handler with RLS awareness
  const handleAuthStateChange = useCallback(async (event: string, newSession: Session | null) => {
    console.log(`Enhanced Auth: RLS-aware state changed - Event: ${event}, User: ${newSession?.user?.email}`);

    setSession(newSession);
    setUser(newSession?.user ?? null);

    try {
      if (event === 'SIGNED_IN' && newSession?.user) {
        console.log(`Enhanced Auth: User signed in (${newSession.user.id}), enhanced RLS account setup...`);
        
        // Give more time for RLS policies and database triggers to process
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const isClient = await waitForClientAccount(newSession.user.id, 15);
        console.log(`Enhanced Auth: Final RLS-verified client status after enhanced sign in: ${isClient}`);
        
      } else if (event === 'SIGNED_OUT') {
        console.log('Enhanced Auth: User signed out, clearing RLS state');
        setIsClientAccount(false);
        
      } else if (event === 'TOKEN_REFRESHED' && newSession?.user) {
        console.log(`Enhanced Auth: Token refreshed for ${newSession.user.email}, verifying RLS client status...`);
        const isClient = await waitForClientAccount(newSession.user.id, 5);
        console.log(`Enhanced Auth: RLS-verified client status after token refresh: ${isClient}`);
      }
    } catch (error) {
      console.error('Enhanced Auth: Error in RLS-aware auth state change handler:', error);
      await logAuthError(error, `enhanced_auth_state_change_rls_${event}`);
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
