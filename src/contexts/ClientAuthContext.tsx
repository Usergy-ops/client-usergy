
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
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

export function ClientAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClientAccount, setIsClientAccount] = useState(false);

  const refreshSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error refreshing session:', error);
      } else {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await checkClientAuth(session.user.id);
        }
      }
    } catch (error) {
      console.error('Error in refreshSession:', error);
    }
  };

  const checkClientAuth = async (userId: string): Promise<boolean> => {
    try {
      console.log('Checking client auth for user:', userId);
      
      // First check if account_types record exists
      const { data: accountData, error: accountError } = await supabase
        .from('account_types')
        .select('account_type')
        .eq('auth_user_id', userId)
        .eq('account_type', 'client')
        .single();
      
      if (accountError && accountError.code !== 'PGRST116') {
        console.error('Error checking account_types:', accountError);
        
        // Fallback: Check if user has client metadata
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser?.user_metadata?.account_type === 'client') {
          console.log('User has client metadata, treating as client account');
          setIsClientAccount(true);
          
          // Try to create missing account record
          try {
            await supabase.rpc('create_client_account_for_user', {
              user_id_param: userId,
              company_name_param: currentUser.user_metadata.companyName || 'My Company',
              first_name_param: currentUser.user_metadata.contactFirstName || '',
              last_name_param: currentUser.user_metadata.contactLastName || ''
            });
            console.log('Created missing client account records');
          } catch (createError) {
            console.error('Error creating missing client account:', createError);
          }
          
          return true;
        }
        
        setIsClientAccount(false);
        return false;
      }
      
      const isClient = !!accountData;
      console.log('Client auth check result:', isClient);
      setIsClientAccount(isClient);
      return isClient;
    } catch (error) {
      console.error('Error in checkClientAuth:', error);
      setIsClientAccount(false);
      return false;
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
        // Add a small delay to ensure database operations have completed
        setTimeout(async () => {
          await checkClientAuth(session.user.id);
        }, 1000);
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
    isClientAccount,
    refreshSession
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
