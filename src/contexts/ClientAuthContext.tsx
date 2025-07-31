
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface ClientAuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isClientAccount: boolean;
  signUp: (email: string, password: string, metadata?: any) => Promise<{ success: boolean; error?: string; emailSent?: boolean }>;
  verifyOTP: (email: string, otpCode: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

export function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClientAccount, setIsClientAccount] = useState(false);
  const { toast } = useToast();

  // Check if user is a client account
  const checkClientStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('account_types')
        .select('account_type')
        .eq('auth_user_id', userId)
        .single();

      if (!error && data) {
        setIsClientAccount(data.account_type === 'client');
      } else {
        setIsClientAccount(false);
      }
    } catch (error) {
      console.error('Error checking client status:', error);
      setIsClientAccount(false);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await checkClientStatus(session.user.id);
        } else {
          setIsClientAccount(false);
        }
        
        setLoading(false);
      }
    );

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await checkClientStatus(session.user.id);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, metadata: any = {}) => {
    try {
      console.log('Starting signup process for:', email);
      
      const redirectUrl = `${window.location.origin}/`;
      
      // Add client-specific metadata to ensure proper account creation
      const signupMetadata = {
        ...metadata,
        signup_source: 'client_signup',
        account_type: 'client',
        companyName: metadata.companyName || 'My Company'
      };

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: signupMetadata
        }
      });

      if (error) {
        console.error('Signup error:', error);
        return { 
          success: false, 
          error: error.message || 'Signup failed. Please try again.' 
        };
      }

      if (data.user && !data.session) {
        // Email confirmation required
        return {
          success: true,
          emailSent: true
        };
      }

      if (data.session) {
        // Immediate login (confirmations disabled)
        console.log('User signed up and logged in immediately');
        return { success: true };
      }

      return {
        success: true,
        emailSent: true
      };

    } catch (error) {
      console.error('Signup exception:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection and try again.'
      };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Sign in error:', error);
      return { 
        success: false, 
        error: 'Network error. Please try again.' 
      };
    }
  };

  const verifyOTP = async (email: string, otpCode: string) => {
    try {
      console.log('Verifying OTP for:', email);

      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'signup'
      });

      if (error) {
        console.error('OTP verification error:', error);
        return { 
          success: false, 
          error: error.message || 'Invalid verification code. Please try again.' 
        };
      }

      if (data.session) {
        console.log('OTP verification successful');
        return { success: true };
      }

      return {
        success: false,
        error: 'Verification failed. Please try again.'
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
          queryParams: {
            signup_source: 'client_signup',
            account_type: 'client'
          }
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
        verifyOTP,
        signOut,
        signInWithGoogle,
        signIn,
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
