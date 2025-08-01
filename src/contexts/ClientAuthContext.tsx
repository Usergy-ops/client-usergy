// src/contexts/ClientAuthContext.tsx
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface ClientAuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isClientAccount: boolean;
  signUp: (email: string, password: string, companyData?: any) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  verifyOTP: (email: string, otp: string, password: string) => Promise<{ error: string | null }>;
  diagnoseAccount: (userId: string) => Promise<any>;
}

// Create the context
const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

// Export the useClientAuth hook
export const useClientAuth = () => {
  const context = useContext(ClientAuthContext);
  if (!context) {
    throw new Error('useClientAuth must be used within a ClientAuthProvider');
  }
  return context;
};

// Export the provider
export const ClientAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClientAccount, setIsClientAccount] = useState(false);

  const checkClientAccount = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('account_types')
        .select('account_type')
        .eq('auth_user_id', userId)
        .single();

      if (!error && data) {
        setIsClientAccount(data.account_type === 'client');
      }
    } catch (error) {
      console.error('Error checking client account:', error);
    }
  }, []);

  const diagnoseAccount = useCallback(async (userId: string) => {
    try {
      // Get user info from auth.users
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      // Get account type info
      const { data: accountType } = await supabase
        .from('account_types')
        .select('*')
        .eq('auth_user_id', userId)
        .single();

      // Get profile info (assuming there's a profiles table)
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      // Check client account status
      const { data: isClientResult } = await supabase.rpc('is_client_account', {
        user_id_param: userId
      });

      return {
        user_exists: !!authUser,
        user_email: authUser?.email,
        user_provider: authUser?.app_metadata?.provider,
        account_type_exists: !!accountType,
        account_type: accountType?.account_type,
        profile_exists: !!profile,
        profile_company: profile?.company_name,
        is_client_account_result: isClientResult
      };
    } catch (error) {
      console.error('Error diagnosing account:', error);
      return {
        user_exists: false,
        user_email: null,
        user_provider: null,
        account_type_exists: false,
        account_type: null,
        profile_exists: false,
        profile_company: null,
        is_client_account_result: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await checkClientAccount(session.user.id);
      }
    } catch (error) {
      console.error('Error refreshing session:', error);
    }
  }, [checkClientAccount]);

  const signUp = async (email: string, password: string, companyData?: any) => {
    try {
      const response = await fetch(`https://lnsyrmpucmllakuuiixe.supabase.co/functions/v1/unified-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxuc3lybXB1Y21sbGFrdXVpaXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNTI5MjQsImV4cCI6MjA2ODkyODkyNH0.kgdtlLTMLEHMBidAAB7fqP9_RhPXsqwI2Tv-TmmyF3Y`
        },
        body: JSON.stringify({
          action: 'signup',
          email,
          password,
          source_domain: 'https://client.usergy.ai',
          ...companyData
        })
      });

      const data = await response.json();
      if (!response.ok) {
        return { error: data.error || 'Signup failed' };
      }
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'An error occurred' };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return { error: error.message };
      }
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'An error occurred' };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });
      
      if (error) {
        return { error: error.message };
      }
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'An error occurred' };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const verifyOTP = async (email: string, otp: string, password: string) => {
    try {
      const response = await fetch(`https://lnsyrmpucmllakuuiixe.supabase.co/functions/v1/unified-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxuc3lybXB1Y21sbGFrdXVpaXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNTI5MjQsImV4cCI6MjA2ODkyODkyNH0.kgdtlLTMLEHMBidAAB7fqP9_RhPXsqwI2Tv-TmmyF3Y`
        },
        body: JSON.stringify({
          action: 'verify',
          email,
          password,
          otp,
          source_domain: 'https://client.usergy.ai'
        })
      });

      const data = await response.json();
      if (!response.ok) {
        return { error: data.error || 'Verification failed' };
      }
      
      // Auto sign in after verification
      await supabase.auth.signInWithPassword({ email, password });
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'An error occurred' };
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkClientAccount(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkClientAccount(session.user.id);
      } else {
        setIsClientAccount(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [checkClientAccount]);

  return (
    <ClientAuthContext.Provider
      value={{
        user,
        session,
        loading,
        isClientAccount,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        refreshSession,
        verifyOTP,
        diagnoseAccount,
      }}
    >
      {children}
    </ClientAuthContext.Provider>
  );
};
