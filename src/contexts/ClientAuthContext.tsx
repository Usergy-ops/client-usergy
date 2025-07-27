
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
  checkClientStatus: () => Promise<void>;
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
      console.log('Checking if user has client account:', userId);
      
      const { data: clientCheck, error } = await supabase.rpc('check_user_is_client', {
        user_id_param: userId
      });
      
      if (error) {
        console.error('Error checking client status:', error);
        return false;
      }
      
      const isClient = clientCheck?.is_client || false;
      console.log('Is client account:', isClient);
      setIsClientAccount(isClient);
      
      return isClient;
    } catch (error) {
      console.error('Error in checkClientAuth:', error);
      return false;
    }
  };

  const checkClientStatus = async () => {
    if (user) {
      await checkClientAuth(user.id);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      console.log('Initial session check:', session?.user?.id);
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        checkClientAuth(session.user.id).then(isClient => {
          if (!mounted) return;
          
          // Only redirect if we're on the landing page and user is verified as client
          if (isClient && window.location.pathname === '/') {
            console.log('Client authenticated, redirecting to dashboard');
            navigate('/dashboard');
          }
        });
      }
      
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        console.log('Auth state change:', event, session?.user?.id);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('User signed in, checking client status...');
          
          // For Google OAuth users, we need to ensure they have a client account
          if (session.user.app_metadata?.provider === 'google') {
            console.log('Google OAuth user detected, ensuring client account...');
            
            // Try to create client account if it doesn't exist
            const { error: createError } = await supabase.rpc('create_client_account_for_user', {
              user_id_param: session.user.id,
              company_name_param: 'My Company',
              first_name_param: session.user.user_metadata?.full_name?.split(' ')[0] || '',
              last_name_param: session.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || ''
            });
            
            if (createError) {
              console.error('Error creating client account:', createError);
            }
          }
          
          // Give time for database triggers to complete
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check if user has client account
          const isClient = await checkClientAuth(session.user.id);
          
          if (isClient) {
            console.log('User is a client, redirecting to dashboard');
            navigate('/dashboard');
          } else {
            console.log('User is not a client, checking if this is a new signup...');
            // For new signups, the trigger might need more time
            setTimeout(async () => {
              const recheckIsClient = await checkClientAuth(session.user.id);
              if (recheckIsClient) {
                console.log('User is now a client after recheck, redirecting to dashboard');
                navigate('/dashboard');
              }
            }, 1000);
          }
        } else if (event === 'SIGNED_OUT') {
          setIsClientAccount(false);
          navigate('/');
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
      console.log('Starting client signup for:', email);
      
      // Use edge function for signup to ensure proper OTP handling
      const { data, error } = await supabase.functions.invoke('client-auth-handler/signup', {
        body: {
          email,
          password,
          companyName,
          firstName: contactFirstName,
          lastName: contactLastName
        }
      });

      if (error) {
        console.error('Signup error:', error);
        return { error };
      }

      console.log('Signup successful, OTP sent');
      return { error: null };
    } catch (error) {
      console.error('Signup exception:', error);
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Signing in:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.error('Sign in error:', error);
        return { error };
      }

      console.log('Sign in successful');
      // Auth state change handler will handle the redirect
      return { error: null };
    } catch (error) {
      console.error('Sign in exception:', error);
      return { error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      console.log('Starting Google OAuth signin');
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
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

      console.log('Google OAuth initiated successfully');
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
    isClientAccount,
    checkClientStatus
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
