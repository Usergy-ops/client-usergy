
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useErrorLogger } from '@/hooks/useErrorLogger';

interface EnhancedClientAuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isClientAccount: boolean;
  setSession: (session: Session | null) => void;
  waitForClientAccount: (userId: string, maxAttempts?: number) => Promise<boolean>;
  diagnoseAccount: (userId: string) => Promise<any>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const EnhancedClientAuthContext = createContext<EnhancedClientAuthContextType | undefined>(undefined);

export function EnhancedClientAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClientAccount, setIsClientAccount] = useState(false);
  const initializingRef = useRef(false);
  const { logAuthError } = useErrorLogger();

  // Enhanced wait for client account with exponential backoff
  const waitForClientAccount = useCallback(async (userId: string, maxAttempts = 15): Promise<boolean> => {
    console.log(`🔍 Enhanced wait: Starting client account verification for user: ${userId}`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`🔍 Enhanced wait: Attempt ${attempt}/${maxAttempts} - Checking client status...`);
        
        // Use a more targeted query
        const { data: isClient, error } = await supabase.rpc('is_client_account', {
          user_id_param: userId
        });

        if (error) {
          console.error(`❌ Enhanced wait: Error on attempt ${attempt}:`, error);
          
          // On the last few attempts, try to force account creation
          if (attempt >= maxAttempts - 2) {
            console.log('🔧 Attempting to force create client account...');
            const { data: forceResult } = await supabase.rpc('force_create_client_account', {
              user_id_param: userId
            });
            console.log('Force create result:', forceResult);
          }
        } else if (isClient) {
          console.log(`✅ Enhanced wait: SUCCESS! Client account confirmed on attempt ${attempt}`);
          setIsClientAccount(true);
          return true;
        } else {
          console.log(`⏳ Enhanced wait: Attempt ${attempt} - Not yet a client account, waiting...`);
        }

        // Enhanced delay calculation with exponential backoff
        if (attempt < maxAttempts) {
          const baseDelay = 1000;
          const exponentialFactor = Math.min(1.5 ** (attempt - 1), 4); // Cap at 4x
          const delay = Math.floor(baseDelay * exponentialFactor);
          
          console.log(`⏳ Enhanced wait: Waiting ${delay}ms before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error(`❌ Enhanced wait: Exception on attempt ${attempt}:`, error);
        await logAuthError(error, `enhanced_client_check_exception_${attempt}`);
        
        if (attempt === maxAttempts) {
          console.error('❌ Enhanced wait: Final attempt failed with exception');
          return false;
        }
        
        // Still wait before retrying on exception
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('❌ Enhanced wait: All attempts exhausted - client account not confirmed');
    setIsClientAccount(false);
    return false;
  }, [logAuthError]);

  // Enhanced account diagnosis
  const diagnoseAccount = useCallback(async (userId: string) => {
    console.log(`🔍 Enhanced: Diagnosing account for user: ${userId}`);
    
    try {
      const { data: diagResult, error } = await supabase.rpc('get_client_account_status', {
        user_id_param: userId
      });
      
      if (error) {
        console.error('Enhanced diagnosis failed:', error);
        return { error: error.message, user_exists: false };
      }
      
      console.log('Enhanced account diagnosis result:', diagResult);
      return diagResult;
    } catch (error) {
      console.error('Enhanced account diagnosis exception:', error);
      await logAuthError(error, 'enhanced_diagnose_account_exception');
      return { error: 'Diagnosis failed', user_exists: false };
    }
  }, [logAuthError]);

  // Enhanced session initialization with better error recovery
  const initializeAuth = useCallback(async () => {
    if (initializingRef.current) {
      console.log('Enhanced Auth: Already initializing, skipping.');
      return;
    }
    
    initializingRef.current = true;
    console.log('🚀 Enhanced Auth: Initializing authentication...');

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Enhanced Auth: Error getting initial session:', error);
        await logAuthError(error, 'enhanced_initialize_auth_get_session');
      } else if (session?.user) {
        console.log(`🔑 Enhanced Auth: Found existing session for: ${session.user.email}`);
        setSession(session);
        setUser(session.user);
        
        // Give time for database operations and check client status
        await new Promise(resolve => setTimeout(resolve, 2000));
        const isClient = await waitForClientAccount(session.user.id, 10);
        console.log(`👤 Enhanced Auth: Initial client status: ${isClient}`);
      } else {
        console.log('🔓 Enhanced Auth: No existing session found.');
        setSession(null);
        setUser(null);
        setIsClientAccount(false);
      }
    } catch (error) {
      console.error('❌ Enhanced Auth: Exception during initialization:', error);
      await logAuthError(error, 'enhanced_initialize_auth_exception');
    } finally {
      setLoading(false);
      initializingRef.current = false;
      console.log('✅ Enhanced Auth: Initialization complete.');
    }
  }, [waitForClientAccount, logAuthError]);

  // Enhanced auth state change handler
  const handleAuthStateChange = useCallback(async (event: string, newSession: Session | null) => {
    console.log(`🔄 Enhanced Auth: State changed - Event: ${event}, User: ${newSession?.user?.email}`);

    setSession(newSession);
    setUser(newSession?.user ?? null);

    try {
      if (event === 'SIGNED_IN' && newSession?.user) {
        console.log(`🔑 Enhanced Auth: User signed in (${newSession.user.id}), checking account setup...`);
        
        // Enhanced timing - give more time for database triggers
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const isClient = await waitForClientAccount(newSession.user.id, 20);
        console.log(`👤 Enhanced Auth: Final client status after sign in: ${isClient}`);
        
      } else if (event === 'SIGNED_OUT') {
        console.log('🔓 Enhanced Auth: User signed out, clearing state');
        setIsClientAccount(false);
        
      } else if (event === 'TOKEN_REFRESHED' && newSession?.user) {
        console.log(`🔄 Enhanced Auth: Token refreshed for ${newSession.user.email}, verifying status...`);
        const isClient = await waitForClientAccount(newSession.user.id, 5);
        console.log(`👤 Enhanced Auth: Client status after token refresh: ${isClient}`);
      }
    } catch (error) {
      console.error('❌ Enhanced Auth: Error in auth state change handler:', error);
      await logAuthError(error, `enhanced_auth_state_change_${event}`);
    }
  }, [waitForClientAccount, logAuthError]);

  useEffect(() => {
    console.log('🚀 Enhanced Auth: Mounting and setting up auth listener.');
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      handleAuthStateChange(event, session);
    });

    initializeAuth();

    return () => {
      console.log('🔄 Enhanced Auth: Unmounting and unsubscribing from auth listener.');
      subscription.unsubscribe();
    };
  }, [initializeAuth, handleAuthStateChange]);

  const refreshSession = useCallback(async () => {
    console.log('🔄 Enhanced Auth: Manually refreshing session...');
    
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('❌ Enhanced Auth: Error refreshing session:', error);
        await logAuthError(error, 'enhanced_refresh_session');
        return;
      }

      console.log(`✅ Enhanced Auth: Session refreshed for: ${session?.user?.email}`);
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const isClient = await waitForClientAccount(session.user.id, 5);
        console.log(`👤 Enhanced Auth: Client status after manual refresh: ${isClient}`);
      } else {
        setIsClientAccount(false);
      }
    } catch (error) {
      console.error('❌ Enhanced Auth: Exception refreshing session:', error);
      await logAuthError(error, 'enhanced_refresh_session_exception');
    }
  }, [waitForClientAccount, logAuthError]);

  const signOut = async () => {
    try {
      console.log('🔓 Enhanced Auth: Signing out...');
      
      setUser(null);
      setSession(null);
      setIsClientAccount(false);
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ Enhanced Auth: Sign out error:', error);
        await logAuthError(error, 'enhanced_sign_out');
      }
      
      window.location.href = '/';
    } catch (error) {
      console.error('❌ Enhanced Auth: Sign out exception:', error);
      await logAuthError(error, 'enhanced_sign_out_exception');
      window.location.href = '/';
    }
  };

  const value = {
    user,
    session,
    loading,
    isClientAccount,
    setSession,
    waitForClientAccount,
    diagnoseAccount,
    signOut,
    refreshSession,
  };

  return (
    <EnhancedClientAuthContext.Provider value={value}>
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
