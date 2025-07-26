import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface ClientAuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, companyName: string, contactFirstName: string, contactLastName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  isClientAccount: boolean;
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

export function ClientAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClientAccount, setIsClientAccount] = useState(false);

  const checkClientAuth = async (userId: string) => {
    try {
      const { data: accountType } = await supabase
        .from('account_types')
        .select('account_type')
        .eq('auth_user_id', userId)
        .eq('account_type', 'client')
        .single();
      
      const isClient = !!accountType;
      setIsClientAccount(isClient);
      
      if (!isClient && userId) {
        // Redirect to user portal if not a client
        window.location.href = 'https://user.usergy.ai';
      }
      
      return isClient;
    } catch (error) {
      console.error('Error checking client auth:', error);
      setIsClientAccount(false);
      return false;
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer client auth check to avoid deadlock
          setTimeout(() => {
            checkClientAuth(session.user.id);
          }, 0);
        } else {
          setIsClientAccount(false);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        checkClientAuth(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (
    email: string, 
    password: string, 
    companyName: string, 
    contactFirstName: string, 
    contactLastName: string
  ) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          companyName,
          contactFirstName,
          contactLastName,
          accountType: 'client'
        }
      }
    });

    if (!error && data.user) {
      // Create account_type record
      await supabase
        .from('account_types')
        .insert({
          auth_user_id: data.user.id,
          account_type: 'client'
        });
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsClientAccount(false);
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
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