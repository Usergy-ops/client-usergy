
import { useState, useEffect } from 'react';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { Button } from '@/components/ui/button';
import { ClientAccountDiagnostics } from '@/utils/clientAccountDiagnostics';
import { supabase } from '@/lib/supabase';

export default function Diagnostics() {
  const { user, session, loading, isClientAccount } = useClientAuth();
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [rlsResults, setRlsResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadBasicDiagnostics();
    }
  }, [user]);

  const loadBasicDiagnostics = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Basic diagnosis using available database functions
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

      setDiagnosis({
        user_exists: true,
        user_email: user.email,
        account_type_exists: !accountError,
        account_type: accountType?.account_type,
        client_record_exists: !clientError,
        client_data: clientRecord,
        is_client_account: isClientAccount
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const runRLSTest = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const result = await ClientAccountDiagnostics.checkRLSPolicies(user.id);
      setRlsResults(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'RLS test failed');
    } finally {
      setIsLoading(false);
    }
  };

  const performBasicRepair = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Call the ensure client account function
      const { data, error } = await supabase.rpc('ensure_client_account', {
        user_id_param: user.id,
        company_name_param: 'My Company'
      });

      if (error) {
        setError(error.message);
      } else {
        // Reload diagnostics after successful repair
        await loadBasicDiagnostics();
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Repair failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Client Diagnostics</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Auth Context State */}
        <div className="bg-card p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Auth Context State</h2>
          <pre className="bg-muted p-3 rounded text-sm overflow-auto">
            {JSON.stringify({
              loading,
              isClientAccount,
              user: user ? { id: user.id, email: user.email } : null,
              session: session ? { 
                access_token: '...', 
                expires_in: session.expires_in,
                expires_at: session.expires_at 
              } : null,
            }, null, 2)}
          </pre>
        </div>

        {/* Control Panel */}
        <div className="bg-card p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Diagnostic Controls</h2>
          <div className="space-y-3">
            <Button 
              onClick={loadBasicDiagnostics} 
              disabled={!user || isLoading}
              className="w-full"
            >
              {isLoading ? 'Loading...' : 'Refresh Diagnostics'}
            </Button>
            
            <Button 
              onClick={runRLSTest} 
              disabled={!user || isLoading}
              variant="outline"
              className="w-full"
            >
              Test RLS Policies
            </Button>
            
            <Button 
              onClick={performBasicRepair} 
              disabled={!user || isLoading}
              variant="destructive"
              className="w-full"
            >
              {isLoading ? 'Repairing...' : 'Repair Account'}
            </Button>
          </div>
          
          {error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded">
              <p className="text-destructive font-medium">Error:</p>
              <p className="text-destructive text-sm">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => setError(null)}
              >
                Clear Error
              </Button>
            </div>
          )}
        </div>

        {/* Basic Account Diagnosis */}
        {diagnosis && (
          <div className="bg-card p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Basic Diagnosis</h2>
            <div className="space-y-2 text-sm">
              <div>User Exists: {diagnosis.user_exists ? '✅' : '❌'}</div>
              <div>Email: {diagnosis.user_email}</div>
              <div>Has Account Type: {diagnosis.account_type_exists ? '✅' : '❌'}</div>
              <div>Account Type: {diagnosis.account_type || 'None'}</div>
              <div>Has Client Record: {diagnosis.client_record_exists ? '✅' : '❌'}</div>
              <div>Is Client Verified: {diagnosis.is_client_account ? '✅' : '❌'}</div>
              {diagnosis.client_data && (
                <div className="mt-4">
                  <h3 className="font-semibold">Client Data:</h3>
                  <pre className="bg-muted p-2 rounded text-xs">
                    {JSON.stringify(diagnosis.client_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* RLS Test Results */}
        {rlsResults && (
          <div className="bg-card p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">RLS Policy Test Results</h2>
            {rlsResults.success ? (
              <div className="space-y-2">
                {rlsResults.data && rlsResults.data.map((result: any, index: number) => (
                  <div key={index} className={`text-sm p-2 rounded ${
                    result.can_access ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {result.table_name} {result.operation}: {result.can_access ? '✅' : '❌'}
                    {result.error_message && ` - ${result.error_message}`}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-red-600">
                RLS Test Failed: {rlsResults.error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
