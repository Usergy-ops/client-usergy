
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();

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

  const createClientAccount = async (userId: string, metadata: any = {}) => {
    try {
      console.log('Creating client account for user:', userId);
      
      // Create account type record
      const { error: accountError } = await supabase
        .from('account_types')
        .insert({ auth_user_id: userId, account_type: 'client' });

      if (accountError) {
        console.error('Error creating account type:', accountError);
      }

      // Create basic company profile
      const { error: profileError } = await supabase
        .from('client_workspace.company_profiles')
        .insert({
          auth_user_id: userId,
          company_name: metadata.companyName || 'My Company',
          contact_first_name: metadata.firstName || '',
          contact_last_name: metadata.lastName || '',
          billing_email: metadata.email || '',
          onboarding_status: 'completed'
        });

      if (profileError) {
        console.error('Error creating company profile:', profileError);
      }

      setIsClientAccount(true);
      return true;
    } catch (error) {
      console.error('Error creating client account:', error);
      return false;
    }
  };

  const handleAuthStateChange = async (event: string, session: Session | null) => {
    console.log('Auth state change:', event, session?.user?.id);
    
    setSession(session);
    setUser(session?.user ?? null);
    
    if (event === 'SIGNED_IN' && session?.user) {
      // Check if user is already a client
      const isClient = await checkClientAuth(session.user.id);
      
      if (!isClient) {
        // Create client account automatically for Google OAuth users
        if (session.user.app_metadata?.provider === 'google') {
          const metadata = {
            companyName: 'My Company',
            firstName: session.user.user_metadata?.full_name?.split(' ')[0] || '',
            lastName: session.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
            email: session.user.email
          };
          
          await createClientAccount(session.user.id, metadata);
        }
      }
      
      // Navigate to dashboard for authenticated users
      navigate('/dashboard');
    } else if (event === 'SIGNED_OUT') {
      setIsClientAccount(false);
      navigate('/');
    }
    
    setLoading(false);
  };

  useEffect(() => {
    // Check initial session
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setSession(session);
          setUser(session.user);
          await checkClientAuth(session.user.id);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error initializing auth:', error);
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthStateChange);

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

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
      navigate('/');
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
