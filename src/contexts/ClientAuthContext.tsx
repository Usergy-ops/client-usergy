
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { retryOperation, isRetryableError } from '@/utils/retryUtility';

interface SignUpResult {
  success: boolean;
  error?: string;
  emailSent?: boolean;
  accountType?: string;
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
          // Check if user is a client account using the consolidated system
          try {
            const { data: accountTypeData, error } = await supabase
              .from('account_types')
              .select('account_type')
              .eq('auth_user_id', session.user.id)
              .single();
            
            const isClient = !error && accountTypeData?.account_type === 'client';
            setIsClientAccount(isClient);
            
            // Enhanced post-authentication redirection
            if (event === 'SIGNED_IN' && isClient) {
              console.log('Client user signed in, preparing for redirection');
              
              // Small delay to ensure state is properly updated
              setTimeout(() => {
                const currentPath = window.location.pathname;
                if (currentPath === '/' || currentPath === '/auth' || currentPath === '/login') {
                  console.log('Redirecting to profile page after successful authentication');
                  window.location.href = '/profile';
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
        
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('User signed in successfully:', session.user.email);
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
      console.log('Starting unified signup process for:', email);

      const result = await retryOperation(
        async () => {
          const { data, error } = await supabase.functions.invoke('unified-auth', {
            body: { 
              action: 'signup',
              email, 
              password,
              companyName: metadata.companyName || 'My Company',
              firstName: metadata.firstName || '',
              lastName: metadata.lastName || '',
              accountType: metadata.accountType || 'client',
              sourceUrl: window.location.origin
            }
          });

          if (error) {
            throw error;
          }

          return data;
        },
        { maxRetries: 3, delay: 1000 }
      );

      console.log('Unified signup response:', result);

      if (result?.success) {
        return {
          success: true,
          emailSent: result.emailSent,
          accountType: result.accountType,
          debug: result.debug
        };
      }

      return {
        success: false,
        error: result?.error || 'Signup failed. Please try again.'
      };

    } catch (error) {
      console.error('Signup exception:', error);
      let errorMessage = 'Network error. Please check your connection and try again.';
      
      if (error?.message?.includes('User already exists')) {
        errorMessage = 'An account with this email already exists. Please try signing in instead.';
      } else if (isRetryableError(error)) {
        errorMessage = 'Service temporarily unavailable. Please try again in a moment.';
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  };

  const signIn = async (email: string, password: string): Promise<SignInResult> => {
    try {
      const result = await retryOperation(
        async () => {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            throw error;
          }

          return data;
        },
        { maxRetries: 2, delay: 1000 }
      );

      return { success: true, session: result.session };
    } catch (error) {
      console.error('Sign in exception:', error);
      
      let errorMessage = 'Sign in failed. Please check your credentials and try again.';
      
      if (error?.message?.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (error?.message?.includes('Email not confirmed')) {
        errorMessage = 'Please verify your email address before signing in.';
      } else if (isRetryableError(error)) {
        errorMessage = 'Service temporarily unavailable. Please try again in a moment.';
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  };

  const verifyOTP = async (email: string, otpCode: string, password?: string): Promise<VerifyOTPResult> => {
    try {
      console.log('Starting unified OTP verification for:', email);

      const result = await retryOperation(
        async () => {
          const { data, error } = await supabase.functions.invoke('unified-auth', {
            body: { 
              action: 'verify-otp',
              email, 
              otpCode, 
              password 
            }
          });

          if (error) {
            throw error;
          }

          return data;
        },
        { maxRetries: 2, delay: 1500 }
      );

      console.log('Unified OTP verification response:', result);

      if (result?.success && result?.session) {
        console.log('OTP verification successful, setting session');
        
        // Set the session manually since we got it from the edge function
        await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token
        });

        return {
          success: true,
          session: result.session
        };
      }

      let errorMessage = result?.error || 'Invalid verification code. Please try again.';
      
      if (result?.error?.includes('Invalid or expired')) {
        errorMessage = 'Invalid or expired verification code. Please request a new code.';
      }

      return {
        success: false,
        error: errorMessage
      };

    } catch (error) {
      console.error('OTP verification exception:', error);
      
      let errorMessage = 'Network error. Please check your connection and try again.';
      
      if (error?.message?.includes('Invalid or expired')) {
        errorMessage = 'Invalid or expired verification code. Please try again or request a new code.';
      } else if (isRetryableError(error)) {
        errorMessage = 'Service temporarily unavailable. Please try again in a moment.';
      }
      
      return {
        success: false,
        error: errorMessage
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
      
      // Store account type for OAuth callback handling - always client for this context
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
