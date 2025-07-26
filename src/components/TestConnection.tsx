import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function TestConnection() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { data, error } = await supabase
          .from('account_types')
          .select('count')
          .limit(1);
          
        if (error) throw error;
        setStatus('connected');
      } catch (error) {
        console.error('Connection error:', error);
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
        setStatus('error');
      }
    };

    checkConnection();
  }, []);

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
    </div>
  );
}