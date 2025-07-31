
import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const BROADCAST_CHANNEL = 'usergy_auth_sync';

export function useSessionBroadcast() {
  // Enhanced broadcast notification with error handling
  const notifyAuthChange = useCallback((eventType: string = 'AUTH_STATE_CHANGE') => {
    if (typeof BroadcastChannel === 'undefined') {
      console.warn('BroadcastChannel not supported in this browser');
      return;
    }

    try {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL);
      channel.postMessage({
        type: eventType,
        timestamp: Date.now(),
        origin: window.location.origin
      });
      channel.close();
    } catch (error) {
      console.error('Error broadcasting auth change:', error);
    }
  }, []);

  // Simple session refresh function
  const refreshSession = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error refreshing session:', error);
      }
      console.log('Session refreshed:', session?.user?.email);
    } catch (error) {
      console.error('Exception refreshing session:', error);
    }
  }, []);

  useEffect(() => {
    // Check if BroadcastChannel is supported
    if (typeof BroadcastChannel === 'undefined') {
      console.warn('BroadcastChannel not supported in this browser');
      return;
    }

    let channel: BroadcastChannel;
    
    try {
      // Create broadcast channel
      channel = new BroadcastChannel(BROADCAST_CHANNEL);

      // Listen for auth changes from other tabs
      channel.onmessage = (event) => {
        console.log('Received auth broadcast:', event.data);
        
        if (event.data.type === 'AUTH_STATE_CHANGE') {
          // Only refresh if from same origin to prevent cross-origin issues
          if (event.data.origin === window.location.origin) {
            console.log('Refreshing session due to auth change in another tab');
            refreshSession();
          }
        }
      };

    } catch (error) {
      console.error('Error setting up BroadcastChannel:', error);
    }

    // Enhanced storage event listener for fallback
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'usergy-client-auth' && e.newValue !== e.oldValue) {
        console.log('Auth token changed in another tab (storage event)');
        refreshSession();
      }
    };

    // Listen for storage events as fallback
    window.addEventListener('storage', handleStorageChange);

    // Listen for focus events to sync auth state when tab becomes active
    const handleFocus = () => {
      console.log('Tab focused, refreshing session...');
      refreshSession();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      try {
        if (channel) {
          channel.close();
        }
      } catch (error) {
        console.error('Error closing BroadcastChannel:', error);
      }
      
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshSession]);

  return {
    notifyAuthChange
  };
}
