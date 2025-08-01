// src/contexts/AuthContext.tsx
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const signUp = async (email: string, password: string) => {
    const sourceDomain = window.location.origin;
    
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unified-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        action: 'signup',
        email,
        password,
        source_domain: sourceDomain
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return { error: null };
  };

  const verifyOTP = async (email: string, otp: string, password: string) => {
    const sourceDomain = window.location.origin;
    
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unified-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        action: 'verify',
        email,
        password,
        otp,
        source_domain: sourceDomain
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    
    // Auto sign in after verification
    await supabase.auth.signInWithPassword({ email, password });
    return { error: null };
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchAccountType(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchAccountType(session.user.id);
      } else {
        setAccountType(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchAccountType = async (userId: string) => {
    const { data, error } = await supabase
      .from('account_types')
      .select('account_type')
      .eq('auth_user_id', userId)
      .single();

    if (!error && data) {
      setAccountType(data.account_type);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      accountType,
      loading,
      signUp,
      verifyOTP,
      signIn: supabase.auth.signInWithPassword,
      signOut: supabase.auth.signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
};