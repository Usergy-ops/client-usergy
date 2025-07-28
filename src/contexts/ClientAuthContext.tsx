
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useErrorLogger } from '@/hooks/useErrorLogger';

interface ClientAuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  isClientAccount: boolean;
  refreshSession: () => Promise<void>;
  checkClientStatus: (userId: string) => Promise<boolean>;
  diagnoseAccount: (userId: string) => Promise<any>;
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

export function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClientAccount, setIsClientAccount] = useState(false);
  const checkInProgressRef = useRef(false);
  const lastCheckRef = useRef<{ userId: string; result: boolean; timestamp: number } | null>(null);
  const { logAuthError } = useErrorLogger();
  
  // Cache duration in milliseconds (5 seconds)
  const CACHE_DURATION = 5000;

  const diagnoseAccount = async (userId: string) => {
    try {
      console.log('Running account diagnosis for user:', userId);
      
      const { data: diagnosisResult, error } = await supabase.rpc('diagnose_user_account', {
        user_id_param: userId
      });

      if (error) {
        console.error('Error diagnosing account:', error);
        return null;
      }

      console.log('Account diagnosis result:', diagnosisResult);
      return diagnosisResult;
    } catch (error) {
      console.error('Exception diagnosing account:', error);
      return null;
    }
  };

  const checkClientStatus = useCallback(async (userId: string): Promise<boolean> => {
    // Check cache first
    if (lastCheckRef.current && 
        lastCheckRef.current.userId === userId && 
        Date.now() - lastCheckRef.current.timestamp < CACHE_DURATION) {
      console.log('ClientAuth: Using cached client status:', lastCheckRef.current.result);
      return lastCheckRef.current.result;
    }

    // Prevent concurrent checks
    if (checkInProgressRef.current) {
      console.log('ClientAuth: Check already in progress, waiting...');
      // Wait for the current check to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      return isClientAccount;
    }

    checkInProgressRef.current = true;

    try {
      console.log('ClientAuth: Checking client status for user:', userId);
      
      const { data: isClient, error } = await supabase.rpc('is_client_account', {
        user_id_param: userId
      });

      if (error) {
        console.error('ClientAuth: Error checking status:', error);
        await logAuthError(error, 'check_client_status');
        return false;
      }

      const result = Boolean(isClient);
      console.log('ClientAuth: Client status result:', result);
      
      // Update cache
      lastCheckRef.current = {
        userId,
        result,
        timestamp: Date.now()
      };
      
      setIsClientAccount(result);
      return result;
    } catch (error) {
      console.error('ClientAuth: Exception checking status:', error);
      await logAuthError(error, 'check_client_status_exception');
      return false;
    } finally {
      checkInProgressRef.current = false;
    }
  }, [isClientAccount, logAuthError]);

  const refreshSession = useCallback(async () => {
    try {
      console.log('ClientAuth: Refreshing session...');
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('ClientAuth: Error refreshing session:', error);
        await logAuthError(error, 'refresh_session');
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await checkClientStatus(session.user.id);
      } else {
        setIsClientAccount(false);
        lastCheckRef.current = null;
      }
    } catch (error) {
      console.error('ClientAuth: Exception refreshing session:', error);
      await logAuthError(error, 'refresh_session_exception');
    }
  }, [checkClientStatus, logAuthError]);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted && session?.user) {
          setSession(session);
          setUser(session.user);
          await checkClientStatus(session.user.id);
        }
      } catch (error) {
        console.error('ClientAuth: Error initializing:', error);
        await logAuthError(error, 'initialize_auth_exception');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log('ClientAuth: Auth state changed:', event);
      
      setSession(session);
      setUser(session?.user ?? null);

      if (event === 'SIGNED_IN' && session?.user) {
        await checkClientStatus(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setIsClientAccount(false);
        lastCheckRef.current = null;
      }

      if (event !== 'INITIAL_SESSION') {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [checkClientStatus, logAuthError]);

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
      console.log('Initiating Google OAuth sign-in...');
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

      console.log('Google OAuth initiated successfully');
      return { error: null };
    } catch (error) {
      console.error('Google OAuth exception:', error);
      await logAuthError(error, 'google_sign_in_exception');
      return { error: { message: 'Failed to sign in with Google' } };
    }
  };

  const signOut = async () => {
    try {
      console.log('Signing out...');
      await supabase.auth.signOut();
      setIsClientAccount(false);
      lastCheckRef.current = null;
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
    signIn,
    signInWithGoogle,
    signOut,
    isClientAccount,
    refreshSession,
    checkClientStatus,
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
