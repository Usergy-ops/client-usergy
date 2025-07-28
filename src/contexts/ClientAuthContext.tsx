
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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

export function ClientAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClientAccount, setIsClientAccount] = useState(false);
  const [checkingClientStatus, setCheckingClientStatus] = useState(false);
  const { logAuthError } = useErrorLogger();

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

  const checkClientStatus = async (userId: string): Promise<boolean> => {
    if (checkingClientStatus) {
      console.log('Client status check already in progress, skipping...');
      return isClientAccount;
    }

    try {
      setCheckingClientStatus(true);
      console.log('Checking client status for user:', userId);
      
      const { data: isClient, error } = await supabase.rpc('is_client_account', {
        user_id_param: userId
      });

      if (error) {
        console.error('Error checking client status:', error);
        await logAuthError(error, 'check_client_status');
        setIsClientAccount(false);
        return false;
      }

      const isClientAcc = Boolean(isClient);
      console.log('Client account status:', isClientAcc);
      setIsClientAccount(isClientAcc);
      return isClientAcc;
    } catch (error) {
      console.error('Exception checking client status:', error);
      await logAuthError(error, 'check_client_status_exception');
      setIsClientAccount(false);
      return false;
    } finally {
      setCheckingClientStatus(false);
    }
  };

  const refreshSession = async () => {
    try {
      console.log('Refreshing session...');
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error refreshing session:', error);
        await logAuthError(error, 'refresh_session');
        return;
      }

      console.log('Session refreshed:', session ? 'found' : 'not found');
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await checkClientStatus(session.user.id);
      } else {
        setIsClientAccount(false);
      }
    } catch (error) {
      console.error('Exception refreshing session:', error);
      await logAuthError(error, 'refresh_session_exception');
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('Initializing authentication...');
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error initializing auth:', error);
          await logAuthError(error, 'initialize_auth');
        } else if (session?.user && mounted) {
          console.log('Initial session found for user:', session.user.email);
          setSession(session);
          setUser(session.user);
          await checkClientStatus(session.user.id);
        } else {
          console.log('No initial session found');
        }
      } catch (error) {
        console.error('Exception initializing auth:', error);
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

      console.log('Auth state changed:', event, session ? session.user.email : 'no session');
      
      setSession(session);
      setUser(session?.user ?? null);

      if (event === 'SIGNED_IN' && session?.user) {
        console.log('User signed in, checking client status...');
        await checkClientStatus(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out');
        setIsClientAccount(false);
      }

      if (event !== 'INITIAL_SESSION') {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [logAuthError]);

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
