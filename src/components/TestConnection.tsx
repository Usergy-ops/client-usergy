
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useClientAuth } from '@/contexts/ClientAuthContext';

export function TestConnection() {
  const { user } = useClientAuth();
  const [status, setStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [clientStatus, setClientStatus] = useState<any>(null);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Test basic database connection
        const { data, error } = await supabase
          .from('account_types')
          .select('count')
          .limit(1);
          
        if (error) throw error;
        
        // Test the new RPC functions if user is logged in
        if (user) {
          const { data: clientCheck, error: clientError } = await supabase.rpc('check_user_is_client', {
            user_id_param: user.id
          });
          
          if (clientError) {
            console.error('Client check error:', clientError);
          } else {
            setClientStatus(clientCheck);
          }
        }
        
        setStatus('connected');
      } catch (error) {
        console.error('Connection error:', error);
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
        setStatus('error');
      }
    };

    checkConnection();
  }, [user]);

  const getStatusColor = () => {
    switch (status) {
      case 'checking': return 'text-yellow-600';
      case 'connected': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-card">
      <h2 className={`text-lg font-semibold ${getStatusColor()}`}>
        Database Connection Status: {status}
      </h2>
      {errorMessage && (
        <p className="text-sm text-destructive mt-2">
          Error: {errorMessage}
        </p>
      )}
      {clientStatus && (
        <div className="mt-2 text-sm">
          <p>Client Status: {clientStatus.is_client ? 'Client Account' : 'Not Client Account'}</p>
          {clientStatus.created_at && (
            <p>Account Created: {new Date(clientStatus.created_at).toLocaleString()}</p>
          )}
        </div>
      )}
    </div>
  );
}
