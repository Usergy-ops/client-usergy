
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface SignUpResult {
  success: boolean;
  error?: string;
  emailSent?: boolean;
  debug?: any;
}

interface SignInResult {
  success: boolean;
  error?: string;
  session?: any;
}

interface VerifyOTPResult {
  success: boolean;
  error?: string;
  session?: any;
}

interface ClientAuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isClientAccount: boolean;
  signUp: (email: string, password: string, metadata?: any) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  verifyOTP: (email: string, otpCode: string, password?: string) => Promise<VerifyOTPResult>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

export function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClientAccount, setIsClientAccount] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Check if user is a client account
          try {
            const { data, error } = await supabase
              .from('client_workflow.clients')
              .select('id')
              .eq('auth_user_id', session.user.id)
              .single();
            
            setIsClientAccount(!error && !!data);
          } catch (error) {
            console.error('Error checking client account:', error);
            setIsClientAccount(false);
          }
        } else {
          setIsClientAccount(false);
        }
        
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('User signed in successfully:', session.user.email);
        }
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, metadata: any = {}): Promise<SignUpResult> => {
    try {
      console.log('Starting signup process for:', email);

      const { data, error } = await supabase.functions.invoke('unified-auth', {
        body: { 
          action: 'signup',
          email, 
          password,
          companyName: metadata.companyName || 'My Company',
          firstName: metadata.firstName || '',
          lastName: metadata.lastName || ''
        }
      });

      console.log('Signup response:', { data, error });

      if (error) {
        console.error('Signup error:', error);
        return { 
          success: false, 
          error: error.message || 'Signup failed. Please try again.' 
        };
      }

      if (data?.success) {
        return {
          success: true,
          emailSent: data.emailSent,
          debug: data.debug
        };
      }

      return {
        success: false,
        error: data?.error || 'Signup failed. Please try again.'
      };

    } catch (error) {
      console.error('Signup exception:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection and try again.'
      };
    }
  };

  const signIn = async (email: string, password: string): Promise<SignInResult> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, session: data.session };
    } catch (error) {
      console.error('Sign in exception:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection and try again.'
      };
    }
  };

  const verifyOTP = async (email: string, otpCode: string, password?: string): Promise<VerifyOTPResult> => {
    try {
      console.log('Starting OTP verification for:', email);

      const { data, error } = await supabase.functions.invoke('unified-auth', {
        body: { 
          action: 'verify-otp',
          email, 
          otpCode, 
          password 
        }
      });

      console.log('OTP verification response:', { data, error });

      if (error) {
        console.error('OTP verification error:', error);
        return { 
          success: false, 
          error: error.message || 'Verification failed. Please try again.' 
        };
      }

      if (data?.success && data?.session) {
        console.log('OTP verification successful, setting session');
        
        // Set the session manually since we got it from the edge function
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });

        return {
          success: true,
          session: data.session
        };
      }

      return {
        success: false,
        error: data?.error || 'Invalid verification code. Please try again.'
      };

    } catch (error) {
      console.error('OTP verification exception:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection and try again.'
      };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
        toast({
          title: "Error",
          description: "Failed to sign out. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Sign out exception:', error);
    }
  };

  const signInWithGoogle = async () => {
    try {
      const redirectUrl = `${window.location.origin}/auth/callback`;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        }
      });

      if (error) {
        console.error('Google sign in error:', error);
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Google sign in exception:', error);
      toast({
        title: "Error",
        description: "Failed to sign in with Google. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <ClientAuthContext.Provider
      value={{
        user,
        session,
        loading,
        isClientAccount,
        signUp,
        signIn,
        verifyOTP,
        signOut,
        signInWithGoogle,
      }}
    >
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
