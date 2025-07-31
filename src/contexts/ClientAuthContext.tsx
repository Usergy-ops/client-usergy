
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
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  setSession: (session: Session | null) => void;
  refreshSession: () => Promise<void>;
  waitForClientAccount: (userId: string, maxAttempts?: number) => Promise<boolean>;
  checkIsClientAccount: (userId: string) => Promise<boolean>;
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

  // Enhanced client account check - works with new backend logic
  const checkIsClientAccount = useCallback(async (userId: string): Promise<boolean> => {
    try {
      console.log('Checking client account status for user:', userId);
      
      // Check account_types table first
      const { data: accountType } = await supabase
        .from('account_types')
        .select('account_type')
        .eq('auth_user_id', userId)
        .single();
      
      if (accountType?.account_type === 'client') {
        console.log('User confirmed as client account type');
        return true;
      }
      
      // If no account type found, the trigger should have created it
      // Let's wait a moment and check again
      if (!accountType) {
        console.log('No account type found, waiting for trigger to process...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const { data: retryAccountType } = await supabase
          .from('account_types')
          .select('account_type')
          .eq('auth_user_id', userId)
          .single();
          
        return retryAccountType?.account_type === 'client';
      }
      
      return false;
    } catch (error) {
      console.error('Error checking client account status:', error);
      return false;
    }
  }, []);

  // Refresh session method
  const refreshSession = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user || null);
      
      if (session?.user) {
        const isClient = await checkIsClientAccount(session.user.id);
        setIsClientAccount(isClient);
      } else {
        setIsClientAccount(false);
      }
    } catch (error) {
      console.error('Session refresh error:', error);
    }
  }, [checkIsClientAccount]);

  // Wait for client account creation - simplified since backend handles it
  const waitForClientAccount = useCallback(async (userId: string, maxAttempts = 10): Promise<boolean> => {
    console.log('Waiting for client account creation for user:', userId);
    
    for (let i = 0; i < maxAttempts; i++) {
      const isClient = await checkIsClientAccount(userId);
      if (isClient) {
        console.log(`Client account confirmed after ${i + 1} attempts`);
        return true;
      }
      
      console.log(`Attempt ${i + 1}/${maxAttempts} - waiting...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.warn('Client account creation timeout after', maxAttempts, 'attempts');
    return false;
  }, [checkIsClientAccount]);

  useEffect(() => {
    // Initialize auth state
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user || null);
        
        if (session?.user) {
          const isClient = await checkIsClientAccount(session.user.id);
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
        console.log('Auth state changed:', event, session?.user?.id);
        
        setSession(session);
        setUser(session?.user || null);
        
        if (session?.user) {
          // For new signups, the backend trigger handles account creation
          // We just need to wait and verify
          const isClient = await checkIsClientAccount(session.user.id);
          setIsClientAccount(isClient);
        } else {
          setIsClientAccount(false);
        }
        
        if (loading) setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [checkIsClientAccount, loading]);

  // Email/Password signup - simplified since backend handles account creation
  const signUp = useCallback(async (email: string, password: string) => {
    try {
      console.log('Starting signup process for:', email);
      
      const { data, error } = await supabase.functions.invoke('client-auth-handler/signup', {
        body: { email, password }
      });

      if (error) {
        console.error('Signup edge function error:', error);
        return { success: false, error: 'Signup failed. Please try again.' };
      }

      if (data?.success) {
        console.log('Signup successful, OTP sent');
        return { success: true };
      }

      return { success: false, error: data?.error || 'Signup failed' };
    } catch (error) {
      console.error('Signup exception:', error);
      return { success: false, error: 'Signup failed. Please try again.' };
    }
  }, []);

  // OTP verification - simplified since backend handles session creation
  const verifyOTP = useCallback(async (email: string, otp: string) => {
    try {
      console.log('Starting OTP verification for:', email);
      
      const { data, error } = await supabase.functions.invoke('client-auth-handler/verify-otp', {
        body: { email, otpCode: otp }
      });

      if (error) {
        console.error('OTP verification edge function error:', error);
        return { success: false, error: 'Invalid verification code' };
      }

      if (data?.success && data?.session) {
        console.log('OTP verification successful, session created');
        // Session will be automatically set by the auth state change listener
        return { success: true };
      }

      return { success: false, error: data?.error || 'Invalid verification code' };
    } catch (error) {
      console.error('OTP verification exception:', error);
      return { success: false, error: 'Verification failed. Please try again.' };
    }
  }, []);

  // Google Auth - simplified
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

  // Alias for backwards compatibility
  const signIn = signInWithPassword;

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
    signIn,
    signOut,
    setSession,
    refreshSession,
    waitForClientAccount,
    checkIsClientAccount,
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
