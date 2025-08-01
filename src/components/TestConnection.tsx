
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { Button } from '@/components/ui/button';
import { ClientAccountDiagnostics } from '@/utils/clientAccountDiagnostics';

export function TestConnection() {
  const { user } = useClientAuth();
  const [status, setStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [clientStatus, setClientStatus] = useState<any>(null);
  const [diagnosticInfo, setDiagnosticInfo] = useState<any>(null);
  const [rlsTestResults, setRlsTestResults] = useState<any[]>([]);
  const [isRepairing, setIsRepairing] = useState(false);
  const [triggerTestResult, setTriggerTestResult] = useState<any>(null);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Test basic database connection
        const { data, error } = await supabase
          .from('account_types')
          .select('id, account_type')
          .limit(1);
          
        if (error) throw error;
        
        console.log('Basic connection test passed:', data);
        
        // Test the client check function if user is logged in
        if (user) {
          const { data: clientCheck, error: clientError } = await supabase.rpc('is_client_account', {
            user_id_param: user.id
          });
          
          if (clientError) {
            console.error('Client check error:', clientError);
            setClientStatus({ error: clientError.message });
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

  const runBasicDiagnostic = async () => {
    if (!user) return;
    
    try {
      // Simple diagnostic check
      const { data: accountType, error: accountError } = await supabase
        .from('account_types')
        .select('account_type')
        .eq('auth_user_id', user.id)
        .single();

      const { data: clientRecord, error: clientError } = await supabase
        .from('client_workflow.clients')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();

      setDiagnosticInfo({
        user_exists: true,
        user_email: user.email,
        account_type_exists: !accountError,
        account_type: accountType?.account_type,
        client_record_exists: !clientError,
        client_data: clientRecord
      });
    } catch (error) {
      console.error('Diagnostic error:', error);
      setDiagnosticInfo({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const testRLSPolicies = async () => {
    if (!user) return;
    
    try {
      const result = await ClientAccountDiagnostics.checkRLSPolicies(user.id);
      
      if (result.success) {
        console.log('RLS test results:', result.data);
        setRlsTestResults(result.data || []);
      } else {
        console.error('RLS test error:', result.error);
        setRlsTestResults([{ error: result.error }]);
      }
    } catch (error) {
      console.error('RLS test exception:', error);
      setRlsTestResults([{ error: error instanceof Error ? error.message : 'Unknown error' }]);
    }
  };

  const testSimplifiedTrigger = async () => {
    if (!user) return;
    
    try {
      const result = await ClientAccountDiagnostics.testSimplifiedTrigger(user.email || '');
      setTriggerTestResult(result);
    } catch (error) {
      console.error('Trigger test error:', error);
      setTriggerTestResult({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  };

  const performBasicRepair = async () => {
    if (!user) return;
    
    setIsRepairing(true);
    try {
      console.log('Performing basic account repair...');
      
      // Call the ensure client account function
      const { data, error } = await supabase.rpc('ensure_client_account', {
        user_id_param: user.id,
        company_name_param: 'My Company'
      });

      if (error) {
        setDiagnosticInfo({ error: error.message });
      } else {
        setDiagnosticInfo({ message: 'Account repair completed', data });
        // Re-run diagnostic after repair
        setTimeout(runBasicDiagnostic, 1000);
      }
    } catch (error) {
      console.error('Repair error:', error);
      setDiagnosticInfo({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsRepairing(false);
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
        Connection Status: {status}
      </h2>
      
      {errorMessage && (
        <p className="text-sm text-destructive">
          Error: {errorMessage}
        </p>
      )}
      
      {clientStatus && (
        <div className="text-sm">
          <p>Client Status: {clientStatus.error ? `Error: ${clientStatus.error}` : 
            clientStatus.is_client ? 'Client Account ✓' : 'Not Client Account ✗'}</p>
        </div>
      )}
      
      {user && (
        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={runBasicDiagnostic} variant="outline" size="sm">
              Run Basic Diagnostic
            </Button>
            
            <Button onClick={testRLSPolicies} variant="outline" size="sm">
              Test RLS
            </Button>
            
            <Button onClick={testSimplifiedTrigger} variant="outline" size="sm">
              Test Trigger
            </Button>
            
            <Button 
              onClick={performBasicRepair} 
              variant="outline" 
              size="sm"
              disabled={isRepairing}
            >
              {isRepairing ? 'Repairing...' : 'Basic Repair'}
            </Button>
          </div>
        </div>
      )}
      
      {/* Display results */}
      {triggerTestResult && (
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <h3 className="text-sm font-semibold mb-2">Trigger Test:</h3>
          <div className="text-xs space-y-1">
            {triggerTestResult.success ? (
              <>
                <div>User ID: {triggerTestResult.data?.user_id}</div>
                <div>Email: {triggerTestResult.data?.email}</div>
                <div>Has Account Type: {triggerTestResult.data?.has_account_type ? '✓' : '✗'}</div>
                <div>Account Type: {triggerTestResult.data?.account_type || 'None'}</div>
                <div>Has Company Profile: {triggerTestResult.data?.has_company_profile ? '✓' : '✗'}</div>
                <div>Company Name: {triggerTestResult.data?.company_name || 'None'}</div>
              </>
            ) : (
              <div className="text-red-600">Error: {triggerTestResult.error}</div>
            )}
          </div>
        </div>
      )}
      
      {diagnosticInfo && (
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <h3 className="text-sm font-semibold mb-2">Diagnostic Info:</h3>
          <div className="text-xs space-y-1">
            {diagnosticInfo.error ? (
              <div className="text-red-600">Error: {diagnosticInfo.error}</div>
            ) : diagnosticInfo.message ? (
              <div className="text-green-600">{diagnosticInfo.message}</div>
            ) : (
              <>
                <div>User Exists: {diagnosticInfo.user_exists ? '✓' : '✗'}</div>
                <div>Email: {diagnosticInfo.user_email}</div>
                <div>Has Account Type: {diagnosticInfo.account_type_exists ? '✓' : '✗'}</div>
                <div>Account Type: {diagnosticInfo.account_type}</div>
                <div>Has Client Record: {diagnosticInfo.client_record_exists ? '✓' : '✗'}</div>
              </>
            )}
          </div>
        </div>
      )}
      
      {rlsTestResults.length > 0 && (
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <h3 className="text-sm font-semibold mb-2">RLS Test Results:</h3>
          <div className="text-xs space-y-1">
            {rlsTestResults.map((result, idx) => (
              <div key={idx} className={result.can_access ? 'text-green-600' : 'text-red-600'}>
                {result.error ? (
                  <span>Error: {result.error}</span>
                ) : (
                  <span>
                    {result.table_name} {result.operation}: {result.can_access ? '✓' : '✗'}
                    {result.error_message && ` (${result.error_message})`}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
