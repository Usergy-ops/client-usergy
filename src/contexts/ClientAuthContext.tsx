
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface ClientAuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isClientAccount: boolean;
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  verifyOTP: (email: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  signInWithGoogle: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(
  undefined
);

export function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClientAccount, setIsClientAccount] = useState(false);
  const { toast } = useToast();

  // Simple session check
  const checkClientAccount = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from('account_types')
        .select('account_type')
        .eq('auth_user_id', userId)
        .single();
      
      return data?.account_type === 'client';
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    // Initialize auth state
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user || null);
        
        if (session?.user) {
          const isClient = await checkClientAccount(session.user.id);
          setIsClientAccount(isClient);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user || null);
        
        if (session?.user) {
          const isClient = await checkClientAccount(session.user.id);
          setIsClientAccount(isClient);
        } else {
          setIsClientAccount(false);
        }
        
        if (loading) setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [checkClientAccount, loading]);

  // Email/Password signup
  const signUp = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('client-auth-handler/signup', {
        body: { email, password }
      });

      if (error) {
        return { success: false, error: 'Signup failed. Please try again.' };
      }

      if (data?.success) {
        return { success: true };
      }

      return { success: false, error: data?.error || 'Signup failed' };
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: 'Signup failed. Please try again.' };
    }
  }, []);

  // OTP verification
  const verifyOTP = useCallback(async (email: string, otp: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('client-auth-handler/verify-otp', {
        body: { email, otpCode: otp }
      });

      if (error) {
        return { success: false, error: 'Invalid verification code' };
      }

      if (data?.success && data?.session) {
        // Session is automatically set by the edge function
        return { success: true };
      }

      return { success: false, error: data?.error || 'Invalid verification code' };
    } catch (error) {
      console.error('OTP verification error:', error);
      return { success: false, error: 'Verification failed. Please try again.' };
    }
  }, []);

  // Google Auth
  const signInWithGoogle = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/client/profile`
        }
      });

      if (error) {
        console.error('Google auth error:', error);
        toast({
          title: "Authentication failed",
          description: "Failed to authenticate with Google. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Google auth exception:', error);
      toast({
        title: "Authentication failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    }
  }, [toast]);

  // Email/Password sign in
  const signInWithPassword = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, error: 'Sign in failed. Please try again.' };
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setIsClientAccount(false);
      
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }, [toast]);

  const value: ClientAuthContextType = {
    user,
    session,
    loading,
    isClientAccount,
    signUp,
    verifyOTP,
    signInWithGoogle,
    signInWithPassword,
    signOut,
  };

  return (
    <ClientAuthContext.Provider value={value}>
      {children}
    </ClientAuthContext.Provider>
  );
}

export function useClientAuth(): ClientAuthContextType {
  const context = useContext(ClientAuthContext);
  if (context === undefined) {
    throw new Error('useClientAuth must be used within a ClientAuthProvider');
  }
  return context;
}
