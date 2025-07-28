
import { useEffect } from 'react';
import { useClientAuth } from '@/contexts/ClientAuthContext';

const BROADCAST_CHANNEL = 'usergy_auth_sync';

export function useSessionBroadcast() {
  const { refreshSession } = useClientAuth();

  useEffect(() => {
    // Check if BroadcastChannel is supported
    if (typeof BroadcastChannel === 'undefined') {
      console.warn('BroadcastChannel not supported in this browser');
      return;
    }

    // Create broadcast channel
    const channel = new BroadcastChannel(BROADCAST_CHANNEL);

    // Listen for auth changes from other tabs
    channel.onmessage = (event) => {
      console.log('Received auth broadcast:', event.data);
      
      if (event.data.type === 'AUTH_STATE_CHANGE') {
        // Refresh our session to sync with other tab
        refreshSession();
      }
    };

    // Notify other tabs when we change auth state
    const notifyOtherTabs = () => {
      channel.postMessage({
        type: 'AUTH_STATE_CHANGE',
        timestamp: Date.now()
      });
    };

    // Listen for storage events as fallback
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'usergy-client-auth') {
        console.log('Auth token changed in another tab');
        refreshSession();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      channel.close();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [refreshSession]);

  return {
    // Could expose functions to manually trigger broadcasts if needed
    notifyAuthChange: () => {
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel(BROADCAST_CHANNEL);
        channel.postMessage({
          type: 'AUTH_STATE_CHANGE',
          timestamp: Date.now()
        });
        channel.close();
      }
    }
  };
}
