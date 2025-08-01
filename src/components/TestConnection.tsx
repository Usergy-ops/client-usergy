
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { Button } from '@/components/ui/button';

export function TestConnection() {
  const { user, diagnoseAccount } = useClientAuth();
  const [status, setStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [clientStatus, setClientStatus] = useState<any>(null);
  const [diagnosticInfo, setDiagnosticInfo] = useState<any>(null);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Test basic database connection
        const { data, error } = await supabase
          .from('account_types')
          .select('count')
          .limit(1);
          
        if (error) throw error;
        
        // Test the updated RPC function if user is logged in
        if (user) {
          const { data: clientCheck, error: clientError } = await supabase.rpc('is_client_account', {
            user_id_param: user.id
          });
          
          if (clientError) {
            console.error('Client check error:', clientError);
          } else {
            setClientStatus({ is_client: clientCheck });
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

  const runDiagnostic = async () => {
    if (!user) return;
    
    try {
      const diagnosis = await diagnoseAccount(user.id);
      setDiagnosticInfo(diagnosis);
    } catch (error) {
      console.error('Diagnostic error:', error);
    }
  };

  const ensureClientAccount = async () => {
    if (!user) return;
    
    try {
      const { data: result, error } = await supabase.rpc('ensure_client_account', {
        user_id_param: user.id,
        company_name_param: 'Test Company',
        first_name_param: 'Test',
        last_name_param: 'User'
      });
      
      if (error) {
        console.error('Ensure client account error:', error);
      } else {
        console.log('Ensure client account result:', result);
        // Re-run diagnostic after ensuring account
        await runDiagnostic();
      }
    } catch (error) {
      console.error('Ensure client account exception:', error);
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'checking': return 'text-yellow-600';
      case 'connected': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-card space-y-4">
      <h2 className={`text-lg font-semibold ${getStatusColor()}`}>
        Database Connection Status: {status}
      </h2>
      
      {errorMessage && (
        <p className="text-sm text-destructive">
          Error: {errorMessage}
        </p>
      )}
      
      {clientStatus && (
        <div className="text-sm">
          <p>Client Status: {clientStatus.is_client ? 'Client Account' : 'Not Client Account'}</p>
        </div>
      )}
      
      {user && (
        <div className="space-y-2">
          <Button onClick={runDiagnostic} variant="outline" size="sm">
            Run Account Diagnostic
          </Button>
          
          <Button onClick={ensureClientAccount} variant="outline" size="sm">
            Ensure Client Account
          </Button>
        </div>
      )}
      
      {diagnosticInfo && (
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <h3 className="text-sm font-semibold mb-2">Account Diagnostic:</h3>
          <div className="text-xs space-y-1">
            <div>User Exists: {diagnosticInfo.user_exists ? '✓' : '✗'}</div>
            <div>Email: {diagnosticInfo.user_email}</div>
            <div>Provider: {diagnosticInfo.user_provider}</div>
            <div>Account Type Exists: {diagnosticInfo.account_type_exists ? '✓' : '✗'}</div>
            <div>Account Type: {diagnosticInfo.account_type}</div>
            <div>Profile Exists: {diagnosticInfo.profile_exists ? '✓' : '✗'}</div>
            <div>Client Info Exists: {diagnosticInfo.client_info_exists ? '✓' : '✗'}</div>
            <div>Client Company: {diagnosticInfo.client_company}</div>
            <div>Client Full Name: {diagnosticInfo.client_full_name}</div>
            <div>Is Client Account: {diagnosticInfo.is_client_account_result ? '✓' : '✗'}</div>
            {diagnosticInfo.error && (
              <div className="text-red-600">Error: {diagnosticInfo.error}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
