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
import { useErrorLogger } from '@/hooks/useErrorLogger';
import { SimplifiedClientDiagnostics } from '@/utils/simplifiedClientDiagnostics';

interface ClientAuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isClientAccount: boolean;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setIsClientAccount: (isClient: boolean) => void;
  waitForClientAccount: (userId: string, maxRetries?: number) => Promise<boolean>;
  diagnoseAccount: (userId: string) => Promise<any | null>;
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
  const { logError } = useErrorLogger();

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        setLoading(true);
        console.log('ClientAuth: Initializing authentication state...');
        
        const { data: { session } } = await supabase.auth.getSession();
        console.log('ClientAuth: Initial session check:', session ? 'Found' : 'None');
        
        if (session?.user && isMounted) {
          setSession(session);
          setUser(session.user);
          
          // Check if user has client record using simplified approach
          const hasClientRecord = await SimplifiedClientDiagnostics.isClientAccount(session.user.id);
          console.log('ClientAuth: Client record status:', hasClientRecord);
          setIsClientAccount(hasClientRecord);
        }
      } catch (error) {
        console.error('ClientAuth: Initialization error:', error);
        await logError('auth_initialization_error', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        
        console.log('ClientAuth: Auth state change:', event, session ? 'Session exists' : 'No session');
        
        try {
          setSession(session);
          setUser(session?.user || null);
          
          if (session?.user) {
            // Check client record status with simplified approach
            const hasClientRecord = await SimplifiedClientDiagnostics.isClientAccount(session.user.id);
            console.log('ClientAuth: Updated client record status:', hasClientRecord);
            setIsClientAccount(hasClientRecord);
          } else {
            setIsClientAccount(false);
          }
        } catch (error) {
          console.error('ClientAuth: Auth state change error:', error);
          await logError('auth_state_change_error', error);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const waitForClientAccount = useCallback(
    async (userId: string, maxRetries: number = 10): Promise<boolean> => {
      let retries = 0;
      const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

      while (retries < maxRetries) {
        try {
          console.log(
            `ClientAuth: Checking client account status (attempt ${
              retries + 1
            }/${maxRetries})`
          );
          const isClient = await SimplifiedClientDiagnostics.isClientAccount(userId);

          if (isClient) {
            console.log('ClientAuth: Client account confirmed.');
            setIsClientAccount(true);
            return true;
          }

          console.log('ClientAuth: Client account not yet found, waiting...');
          retries++;
          await delay(1500); // Wait 1.5 seconds
        } catch (error) {
          console.error('ClientAuth: Error checking client account:', error);
          await logError('client_check_error', error, userId);
          return false; // Consider returning false on error
        }
      }

      console.warn('ClientAuth: Max retries reached, client account not confirmed.');
      toast({
        title: "Account setup incomplete",
        description: "We're still setting up your account. Please check back in a few minutes.",
        variant: "destructive"
      });
      return false;
    },
    [toast, logError]
  );

  const diagnoseAccount = useCallback(async (userId: string) => {
    try {
      console.log('ClientAuth: Starting account diagnosis for:', userId);
      const result = await SimplifiedClientDiagnostics.checkUserAccountStatus(userId);
      console.log('ClientAuth: Diagnosis result:', result);
      return result;
    } catch (error) {
      console.error('ClientAuth: Diagnosis error:', error);
      await logError('account_diagnosis_error', error, userId);
      return null;
    }
  }, [logError]);

  const value: ClientAuthContextType = {
    user,
    session,
    loading,
    isClientAccount,
    setSession,
    setUser,
    setIsClientAccount,
    waitForClientAccount,
    diagnoseAccount,
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
