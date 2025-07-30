
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
  const [rlsTestResults, setRlsTestResults] = useState<any[]>([]);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Test basic database connection with RLS-enabled table
        const { data, error } = await supabase
          .from('account_types')
          .select('id, account_type')
          .limit(1);
          
        if (error) throw error;
        
        console.log('Basic connection test passed:', data);
        
        // Test the enhanced RPC function if user is logged in
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

  const runDiagnostic = async () => {
    if (!user) return;
    
    try {
      const diagnosis = await diagnoseAccount(user.id);
      setDiagnosticInfo(diagnosis);
    } catch (error) {
      console.error('Diagnostic error:', error);
      setDiagnosticInfo({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const testRLSPolicies = async () => {
    if (!user) return;
    
    try {
      const { data: results, error } = await supabase.rpc('test_rls_policies_for_user', {
        test_user_id: user.id
      });
      
      if (error) {
        console.error('RLS test error:', error);
        setRlsTestResults([{ error: error.message }]);
      } else {
        console.log('RLS test results:', results);
        setRlsTestResults(results || []);
      }
    } catch (error) {
      console.error('RLS test exception:', error);
      setRlsTestResults([{ error: error instanceof Error ? error.message : 'Unknown error' }]);
    }
  };

  const forceCreateAccount = async () => {
    if (!user) return;
    
    try {
      console.log('Force creating client account...');
      const { data: result, error } = await supabase.rpc('create_client_account_unified', {
        user_id_param: user.id,
        company_name_param: 'Test Company',
        first_name_param: user.user_metadata?.first_name || 'Test',
        last_name_param: user.user_metadata?.last_name || 'User'
      });
      
      if (error) {
        console.error('Force create error:', error);
        setDiagnosticInfo({ error: error.message });
      } else {
        console.log('Force create result:', result);
        setDiagnosticInfo(result);
        // Re-run diagnostic after force create
        setTimeout(runDiagnostic, 1000);
      }
    } catch (error) {
      console.error('Force create exception:', error);
      setDiagnosticInfo({ error: error instanceof Error ? error.message : 'Unknown error' });
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
        Enhanced Connection Status: {status}
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
            <Button onClick={runDiagnostic} variant="outline" size="sm">
              Run Enhanced Diagnostic
            </Button>
            
            <Button onClick={testRLSPolicies} variant="outline" size="sm">
              Test RLS Policies
            </Button>
            
            <Button onClick={forceCreateAccount} variant="outline" size="sm">
              Force Create Client Account
            </Button>
          </div>
        </div>
      )}
      
      {diagnosticInfo && (
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <h3 className="text-sm font-semibold mb-2">Enhanced Account Diagnostic:</h3>
          <div className="text-xs space-y-1">
            {diagnosticInfo.error ? (
              <div className="text-red-600">Error: {diagnosticInfo.error}</div>
            ) : (
              <>
                <div>User Exists: {diagnosticInfo.user_exists ? '✓' : '✗'}</div>
                <div>Email: {diagnosticInfo.user_email}</div>
                <div>Provider: {diagnosticInfo.user_provider}</div>
                <div>Has Account Type: {diagnosticInfo.has_account_type ? '✓' : '✗'}</div>
                <div>Account Type: {diagnosticInfo.account_type}</div>
                <div>Has Company Profile: {diagnosticInfo.has_company_profile ? '✓' : '✗'}</div>
                <div>Company: {diagnosticInfo.company_name}</div>
                <div>Is Client Account: {diagnosticInfo.is_client_account_result ? '✓' : '✗'}</div>
                {diagnosticInfo.issues && diagnosticInfo.issues.length > 0 && (
                  <div className="mt-2 text-orange-600">
                    <div className="font-semibold">Issues:</div>
                    {diagnosticInfo.issues.map((issue: string, idx: number) => (
                      <div key={idx}>• {issue}</div>
                    ))}
                  </div>
                )}
                {diagnosticInfo.recommendations && diagnosticInfo.recommendations.length > 0 && (
                  <div className="mt-2 text-blue-600">
                    <div className="font-semibold">Recommendations:</div>
                    {diagnosticInfo.recommendations.map((rec: string, idx: number) => (
                      <div key={idx}>• {rec}</div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      
      {rlsTestResults.length > 0 && (
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <h3 className="text-sm font-semibold mb-2">RLS Policy Test Results:</h3>
          <div className="text-xs space-y-1">
            {rlsTestResults.map((result, idx) => (
              <div key={idx} className={result.can_access ? 'text-green-600' : 'text-red-600'}>
                {result.table_name} {result.operation}: {result.can_access ? '✓' : '✗'}
                {result.error_message && ` (${result.error_message})`}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
