
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
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

export function ClientAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClientAccount, setIsClientAccount] = useState(false);
  const { logAuthError } = useErrorLogger();

  const checkClientStatus = async (userId: string): Promise<boolean> => {
    try {
      const { data: isClient, error } = await supabase.rpc('is_client_account', {
        user_id_param: userId
      });

      if (error) {
        await logAuthError(error, 'check_client_status');
        setIsClientAccount(false);
        return false;
      }

      const isClientAcc = Boolean(isClient);
      setIsClientAccount(isClientAcc);
      return isClientAcc;
    } catch (error) {
      await logAuthError(error, 'check_client_status_exception');
      setIsClientAccount(false);
      return false;
    }
  };

  const refreshSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        await logAuthError(error, 'refresh_session');
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await checkClientStatus(session.user.id);
      } else {
        setIsClientAccount(false);
      }
    } catch (error) {
      await logAuthError(error, 'refresh_session_exception');
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          await logAuthError(error, 'initialize_auth');
        } else if (session?.user && mounted) {
          setSession(session);
          setUser(session.user);
          await checkClientStatus(session.user.id);
        }
      } catch (error) {
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

      setSession(session);
      setUser(session?.user ?? null);

      if (event === 'SIGNED_IN' && session?.user) {
        await checkClientStatus(session.user.id);
      } else if (event === 'SIGNED_OUT') {
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
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        await logAuthError(error, 'sign_in');
        return { error };
      }

      return { error: null };
    } catch (error) {
      await logAuthError(error, 'sign_in_exception');
      return { error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        }
      });

      if (error) {
        await logAuthError(error, 'google_sign_in');
        return { error };
      }

      return { error: null };
    } catch (error) {
      await logAuthError(error, 'google_sign_in_exception');
      return { error: { message: 'Failed to sign in with Google' } };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setIsClientAccount(false);
      window.location.href = '/';
    } catch (error) {
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
