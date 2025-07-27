
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
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

export function ClientAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClientAccount, setIsClientAccount] = useState(false);

  const checkClientAuth = async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('account_types')
        .select('account_type')
        .eq('auth_user_id', userId)
        .eq('account_type', 'client')
        .single();
      
      if (error) {
        console.error('Error checking client status:', error);
        return false;
      }
      
      const isClient = !!data;
      setIsClientAccount(isClient);
      return isClient;
    } catch (error) {
      console.error('Error in checkClientAuth:', error);
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
        } else if (session?.user && mounted) {
          console.log('Initial session found:', session.user.id);
          setSession(session);
          setUser(session.user);
          await checkClientAuth(session.user.id);
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
        await checkClientAuth(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setIsClientAccount(false);
      }
      
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
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
      const { data, error } = await supabase.auth.signInWithOAuth({
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
    isClientAccount
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
