
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';

interface ClientAuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, companyName: string, contactFirstName: string, contactLastName: string) => Promise<{ error: any }>;
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

  const checkClientAuth = async (userId: string, isNewSignup = false) => {
    try {
      // For new signups, wait a bit for the trigger to create account type
      if (isNewSignup) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const { data: accountType, error } = await supabase
        .from('account_types')
        .select('account_type')
        .eq('auth_user_id', userId)
        .eq('account_type', 'client')
        .maybeSingle();
      
      if (error) {
        console.error('Error checking account type:', error);
        return false;
      }
      
      const isClient = !!accountType;
      setIsClientAccount(isClient);
      
      // Only redirect if it's not a new signup and user is not a client
      if (!isClient && !isNewSignup) {
        // Check if they have a user account
        const { data: userAccount } = await supabase
          .from('account_types')
          .select('account_type')
          .eq('auth_user_id', userId)
          .eq('account_type', 'user')
          .maybeSingle();
        
        if (userAccount) {
          // They have a user account, redirect to user portal
          window.location.href = 'https://user.usergy.ai';
        } else {
          // No account type at all, sign them out
          await supabase.auth.signOut();
          navigate('/');
        }
      }
      
      return isClient;
    } catch (error) {
      console.error('Error checking client auth:', error);
      setIsClientAccount(false);
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        checkClientAuth(session.user.id);
      }
      setLoading(false);
    });

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        console.log('Auth state change:', event, session?.user?.id);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (event === 'SIGNED_IN' && session?.user) {
          // Check if this is a new signup based on metadata
          const isNewSignup = session.user.user_metadata?.accountType === 'client' &&
                            !session.user.last_sign_in_at;
          
          const isClient = await checkClientAuth(session.user.id, isNewSignup);
          
          // Only redirect if they are a client
          if (isClient) {
            console.log('Client authenticated successfully - redirecting to dashboard');
            navigate('/dashboard');
          }
        } else if (!session) {
          setIsClientAccount(false);
        }
        
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const signUp = async (
    email: string, 
    password: string, 
    companyName: string, 
    contactFirstName: string, 
    contactLastName: string
  ) => {
    try {
      // Try the enhanced signup flow first
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('client-auth-handler/signup', {
        body: {
          email,
          password,
          companyName,
          firstName: contactFirstName,
          lastName: contactLastName
        }
      });

      // If edge function succeeds, return success
      if (!edgeError && edgeData?.success) {
        return { error: null };
      }

      // If edge function has a specific error, return it
      if (edgeData?.error) {
        return { error: { message: edgeData.error } };
      }

      // Fallback to original signup method
      console.log('Using fallback signup method...');
      
      // First check if email exists as a client
      const { data: existingClient } = await supabase
        .rpc('check_email_exists_for_account_type', {
          email_param: email,
          account_type_param: 'client'
        });

      if (existingClient) {
        return { 
          error: { 
            message: 'This email is already registered as a client. Please sign in instead.' 
          } 
        };
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            companyName,
            contactFirstName,
            contactLastName,
            accountType: 'client'
          }
        }
      });

      if (error) {
        // Handle Supabase auth errors
        if (error.message.includes('already registered')) {
          return { 
            error: { 
              message: 'This email is already in use. You can use the same email for both user and client accounts - please continue with sign up.' 
            } 
          };
        }
        return { error };
      }

      // The trigger will handle creating the account type and profile
      return { error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) return { error };

      // After successful sign in, check if they have a client account
      if (data.user) {
        const isClient = await checkClientAuth(data.user.id);
        if (!isClient) {
          // They don't have a client account, the checkClientAuth will redirect
          return { 
            error: { 
              message: 'No client account found. Redirecting to user portal...' 
            } 
          };
        }
      }

      return { error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      console.log('Starting Google OAuth signin');
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
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
    signUp,
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
