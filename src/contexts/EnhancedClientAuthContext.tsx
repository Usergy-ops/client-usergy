
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

interface VerifyOTPResult {
  success: boolean;
  error?: string;
  session?: any;
}

interface EnhancedClientAuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata?: any) => Promise<SignUpResult>;
  verifyOTP: (email: string, otpCode: string, password?: string) => Promise<VerifyOTPResult>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  isClientAccount: (userId: string) => Promise<boolean>;
}

const EnhancedClientAuthContext = createContext<EnhancedClientAuthContextType | undefined>(undefined);

export function EnhancedClientAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Enhanced Auth state change:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('Enhanced User signed in successfully:', session.user.email);
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
      console.log('Enhanced: Starting unified auth signup process for:', email);

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

      console.log('Enhanced: Unified auth signup response:', { data, error });

      if (error) {
        console.error('Enhanced: Unified auth signup error:', error);
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
      console.error('Enhanced: Unified auth signup exception:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection and try again.'
      };
    }
  };

  const verifyOTP = async (email: string, otpCode: string, password?: string): Promise<VerifyOTPResult> => {
    try {
      console.log('Enhanced: Starting unified auth OTP verification for:', email);

      const { data, error } = await supabase.functions.invoke('unified-auth', {
        body: { 
          action: 'verify-otp',
          email, 
          otpCode, 
          password 
        }
      });

      console.log('Enhanced: Unified auth OTP verification response:', { data, error });

      if (error) {
        console.error('Enhanced: Unified auth OTP verification error:', error);
        return { 
          success: false, 
          error: error.message || 'Verification failed. Please try again.' 
        };
      }

      if (data?.success && data?.session) {
        console.log('Enhanced: Unified auth OTP verification successful, setting session');
        
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
      console.error('Enhanced: Unified auth OTP verification exception:', error);
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
        console.error('Enhanced: Sign out error:', error);
        toast({
          title: "Error",
          description: "Failed to sign out. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Enhanced: Sign out exception:', error);
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
        console.error('Enhanced: Google sign in error:', error);
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Enhanced: Google sign in exception:', error);
      toast({
        title: "Error",
        description: "Failed to sign in with Google. Please try again.",
        variant: "destructive",
      });
    }
  };

  const isClientAccount = async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('client_workflow.clients')
        .select('id')
        .eq('auth_user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Enhanced: Error checking client account:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Enhanced: Exception checking client account:', error);
      return false;
    }
  };

  return (
    <EnhancedClientAuthContext.Provider
      value={{
        user,
        session,
        loading,
        signUp,
        verifyOTP,
        signOut,
        signInWithGoogle,
        isClientAccount,
      }}
    >
      {children}
    </EnhancedClientAuthContext.Provider>
  );
}

export function useEnhancedClientAuth() {
  const context = useContext(EnhancedClientAuthContext);
  if (context === undefined) {
    throw new Error('useEnhancedClientAuth must be used within an EnhancedClientAuthProvider');
  }
  return context;
}
