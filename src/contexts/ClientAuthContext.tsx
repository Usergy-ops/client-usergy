
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
  waitForClientAccount: (userId: string, maxAttempts?: number) => Promise<boolean>;
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

export function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClientAccount, setIsClientAccount] = useState(false);
  const initializingRef = useRef(false);
  const { logAuthError } = useErrorLogger();

  // Wait for client account with retries
  const waitForClientAccount = useCallback(async (userId: string, maxAttempts = 5): Promise<boolean> => {
    console.log(`Waiting for client account creation for user: ${userId}`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${maxAttempts} to verify client account...`);
        
        const { data: isClient, error } = await supabase.rpc('is_client_account', {
          user_id_param: userId
        });

        if (error) {
          console.error('Error checking client status:', error);
          if (attempt === maxAttempts) {
            await logAuthError(error, 'check_client_status_final_attempt');
            return false;
          }
        } else if (isClient) {
          console.log('Client account confirmed!');
          setIsClientAccount(true);
          return true;
        }

        // If not last attempt, wait before retrying
        if (attempt < maxAttempts) {
          const delay = attempt * 1000; // Exponential backoff
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error(`Exception on attempt ${attempt}:`, error);
        if (attempt === maxAttempts) {
          await logAuthError(error, 'check_client_status_exception');
        }
      }
    }

    console.log('Client account not found after all attempts');
    setIsClientAccount(false);
    return false;
  }, [logAuthError]);

  // Initialize auth state
  const initializeAuth = useCallback(async () => {
    // Prevent multiple initializations
    if (initializingRef.current) {
      console.log('Already initializing auth, skipping...');
      return;
    }
    
    initializingRef.current = true;
    console.log('Initializing authentication...');

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting initial session:', error);
        await logAuthError(error, 'initialize_auth');
      } else if (session?.user) {
        console.log('Found existing session for:', session.user.email);
        setSession(session);
        setUser(session.user);
        
        // Check if user is a client
        const isClient = await waitForClientAccount(session.user.id, 3);
        console.log('Initial client status:', isClient);
      } else {
        console.log('No existing session found');
      }
    } catch (error) {
      console.error('Exception during auth initialization:', error);
      await logAuthError(error, 'initialize_auth_exception');
    } finally {
      setLoading(false);
      initializingRef.current = false;
    }
  }, [waitForClientAccount, logAuthError]);

  // Set up auth listener
  useEffect(() => {
    let mounted = true;

    // Initialize immediately
    initializeAuth();

    // Set up listener for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      console.log('Auth state changed:', event, newSession?.user?.email);

      // Update session immediately
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (event === 'SIGNED_IN' && newSession?.user) {
        // For sign in events, ensure client account exists
        console.log('User signed in, ensuring client account...');
        
        // First try to create account if it doesn't exist
        const { data: ensureResult } = await supabase.rpc('ensure_client_account', {
          user_id_param: newSession.user.id,
          company_name_param: newSession.user.user_metadata?.companyName || 'My Company',
          first_name_param: newSession.user.user_metadata?.contactFirstName || 
                           newSession.user.user_metadata?.full_name?.split(' ')[0] || '',
          last_name_param: newSession.user.user_metadata?.contactLastName || 
                          newSession.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || ''
        });

        if (ensureResult?.success) {
          console.log('Client account ensured successfully');
        }

        // Then verify with retries
        const isClient = await waitForClientAccount(newSession.user.id);
        console.log('Client status after sign in:', isClient);
        
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out');
        setIsClientAccount(false);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [initializeAuth, waitForClientAccount]);

  // Refresh session manually
  const refreshSession = useCallback(async () => {
    console.log('Manually refreshing session...');
    
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error refreshing session:', error);
        await logAuthError(error, 'refresh_session');
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const isClient = await waitForClientAccount(session.user.id, 3);
        console.log('Client status after refresh:', isClient);
      } else {
        setIsClientAccount(false);
      }
    } catch (error) {
      console.error('Exception refreshing session:', error);
      await logAuthError(error, 'refresh_session_exception');
    }
  }, [waitForClientAccount, logAuthError]);

  // Sign in method
  const signIn = async (email: string, password: string) => {
    try {
      console.log('Signing in with email:', email);
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('Sign in error:', error);
        await logAuthError(error, 'sign_in');
        return { error };
      }

      // Auth state change will handle the rest
      return { error: null };
    } catch (error) {
      console.error('Sign in exception:', error);
      await logAuthError(error, 'sign_in_exception');
      return { error };
    }
  };

  // Sign in with Google
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
        await logAuthError(error, 'google_sign_in');
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Google OAuth exception:', error);
      await logAuthError(error, 'google_sign_in_exception');
      return { error: { message: 'Failed to sign in with Google' } };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      console.log('Signing out...');
      await supabase.auth.signOut();
      
      // Clear state
      setUser(null);
      setSession(null);
      setIsClientAccount(false);
      
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out error:', error);
      await logAuthError(error, 'sign_out');
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
    waitForClientAccount,
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
