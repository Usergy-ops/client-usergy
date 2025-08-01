import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedClientService } from '@/services/UnifiedClientService';
import { useToast } from '@/hooks/use-toast';

interface SignUpResult {
  success: boolean;
  error?: string;
  emailSent?: boolean;
  accountType?: string;
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
  refreshSession: () => Promise<void>;
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
          // Use unified service to check client account status
          try {
            const isClient = await UnifiedClientService.isClientAccount(session.user.id);
            setIsClientAccount(isClient);
            
            if (event === 'SIGNED_IN' && isClient) {
              console.log('Client user signed in successfully');
              
              // Redirect to dashboard for client users
              setTimeout(() => {
                const currentPath = window.location.pathname;
                if (currentPath === '/' || currentPath === '/auth' || currentPath === '/login') {
                  window.location.href = '/dashboard';
                }
              }, 1000);
            }
          } catch (error) {
            console.error('Error checking client account:', error);
            setIsClientAccount(false);
          }
        } else {
          setIsClientAccount(false);
        }
        
        if (event === 'SIGNED_OUT') {
          console.log('User signed out');
          setIsClientAccount(false);
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
          lastName: metadata.lastName || '',
          accountType: 'client',
          sourceUrl: window.location.origin
        }
      });

      if (error) {
        console.error('Signup error:', error);
        return {
          success: false,
          error: error.message || 'Signup failed'
        };
      }

      if (data?.success) {
        return {
          success: true,
          emailSent: data.emailSent,
          accountType: data.accountType
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
        console.error('Sign in error:', error);
        let errorMessage = 'Sign in failed. Please check your credentials and try again.';
        
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please check your credentials and try again.';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Please verify your email address before signing in.';
        }
        
        return {
          success: false,
          error: errorMessage
        };
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

      if (error) {
        console.error('OTP verification error:', error);
        return {
          success: false,
          error: error.message || 'Verification failed'
        };
      }

      if (data?.success && data?.session) {
        console.log('OTP verification successful');
        
        // Set the session manually
        if (data.session.access_token && data.session.refresh_token) {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token
          });
        }

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
      
      localStorage.setItem('pending_account_type', 'client');
      localStorage.setItem('pending_source_url', window.location.origin);
      
      console.log('Starting Google OAuth with redirect URL:', redirectUrl);
      
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

  const refreshSession = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('Session refresh error:', error);
      } else {
        console.log('Session refreshed successfully');
      }
    } catch (error) {
      console.error('Session refresh exception:', error);
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
        refreshSession,
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
