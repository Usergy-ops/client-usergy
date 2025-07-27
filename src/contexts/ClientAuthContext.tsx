
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { redirectToUserPortal, redirectToDashboard, redirectToProfile, logRedirect } from '@/utils/authRedirectUtils';

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

  const checkClientAuth = async (userId: string, retryCount = 0): Promise<boolean> => {
    try {
      console.log('Checking if user has client account:', userId, 'retry:', retryCount);
      
      // Use the new RPC function for better reliability
      const { data: clientCheck, error } = await supabase.rpc('check_user_is_client', {
        user_id_param: userId
      });
      
      if (error) {
        console.error('Error checking client status:', error);
        
        // For new Google OAuth users, retry a few times as the trigger might be processing
        if (retryCount < 3) {
          console.log('Retrying client check in 1 second...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          return checkClientAuth(userId, retryCount + 1);
        }
        
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
            redirectToDashboard();
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
          
          // For Google OAuth, give more time for the trigger to complete
          const isGoogleUser = session.user.app_metadata?.provider === 'google';
          if (isGoogleUser) {
            console.log('Google OAuth user, waiting for account setup...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
          // Check if user has client account
          const isClient = await checkClientAuth(session.user.id);
          
          if (isClient) {
            // Check if profile is complete using client_workspace schema
            const { data: profile } = await supabase
              .from('client_workspace.company_profiles')
              .select('onboarding_status')
              .eq('auth_user_id', session.user.id)
              .maybeSingle();
            
            if (profile?.onboarding_status === 'complete') {
              console.log('Profile complete, redirecting to dashboard');
              redirectToDashboard();
            } else {
              console.log('Profile incomplete, redirecting to profile setup');
              redirectToProfile();
            }
          } else {
            console.log('User is not a client, redirecting to user portal');
            redirectToUserPortal();
          }
        } else if (event === 'SIGNED_OUT') {
          setIsClientAccount(false);
        }
        
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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
