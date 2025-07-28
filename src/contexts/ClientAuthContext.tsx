
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

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

  const checkClientStatus = async (userId: string): Promise<boolean> => {
    try {
      console.log('Checking client status for user:', userId);
      
      const { data: isClient, error } = await supabase.rpc('is_client_account', {
        user_id_param: userId
      });

      if (error) {
        console.error('Error checking client status:', error);
        setIsClientAccount(false);
        return false;
      }

      const isClientAcc = Boolean(isClient);
      console.log('Client status result:', isClientAcc);
      setIsClientAccount(isClientAcc);
      return isClientAcc;
    } catch (error) {
      console.error('Exception checking client status:', error);
      setIsClientAccount(false);
      return false;
    }
  };

  const refreshSession = async () => {
    try {
      console.log('Refreshing session...');
      
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error refreshing session:', error);
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
      console.error('Error in refreshSession:', error);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('Initializing auth...');
        
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error);
        } else if (session?.user && mounted) {
          console.log('Initial session found:', session.user.id);
          setSession(session);
          setUser(session.user);
          await checkClientStatus(session.user.id);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log('Auth state change:', event, session?.user?.id);

      setSession(session);
      setUser(session?.user ?? null);

      if (event === 'SIGNED_IN' && session?.user) {
        console.log('User signed in, checking client status...');
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
  }, []); // Remove all dependencies to prevent infinite loops

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('Sign in error:', error);
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Sign in exception:', error);
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
        console.error('Google OAuth error:', error);
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Google signin error:', error);
      return { error: { message: 'Failed to sign in with Google' } };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setIsClientAccount(false);
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out error:', error);
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
