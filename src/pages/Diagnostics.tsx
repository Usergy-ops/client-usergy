import { useState, useEffect } from 'react';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { Button } from '@/components/ui/button';
import { ClientAccountDiagnostics } from '@/utils/clientAccountDiagnostics';

export default function Diagnostics() {
  const { user, session, loading, isClientAccount, diagnoseAccount, getAccountHealth, repairAccount } = useClientAuth();
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [accountHealth, setAccountHealth] = useState<any>(null);
  const [rlsResults, setRlsResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadInitialDiagnostics();
    }
  }, [user]);

  const loadInitialDiagnostics = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Load basic diagnosis
      const diagResult = await diagnoseAccount(user.id);
      setDiagnosis(diagResult);
      
      // Load account health
      const healthResult = await getAccountHealth(user.id);
      setAccountHealth(healthResult);
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

  const performRepair = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const success = await repairAccount(user.id);
      if (success) {
        // Reload diagnostics after successful repair
        await loadInitialDiagnostics();
      } else {
        setError('Account repair failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Repair failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Enhanced Client Diagnostics</h1>
      
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
              onClick={loadInitialDiagnostics} 
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
              onClick={performRepair} 
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

        {/* Account Health Report */}
        {accountHealth && (
          <div className="bg-card p-4 rounded-lg lg:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Account Health Report</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold text-green-600 mb-2">Status Checks</h3>
                <div className="space-y-1 text-sm">
                  <div>User Exists: {accountHealth.userExists ? '✅' : '❌'}</div>
                  <div>Has Account Type: {accountHealth.hasAccountType ? '✅' : '❌'}</div>
                  <div>Account Type: {accountHealth.accountType || 'None'}</div>
                  <div>Has Company Profile: {accountHealth.hasCompanyProfile ? '✅' : '❌'}</div>
                  <div>Is Client Verified: {accountHealth.isClientVerified ? '✅' : '❌'}</div>
                </div>
              </div>
              
              <div>
                {accountHealth.issues && accountHealth.issues.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-orange-600 mb-2">Issues Found</h3>
                    <ul className="text-sm space-y-1">
                      {accountHealth.issues.map((issue: string, index: number) => (
                        <li key={index} className="text-orange-600">• {issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {accountHealth.recommendations && accountHealth.recommendations.length > 0 && (
                  <div className="mt-4">
                    <h3 className="font-semibold text-blue-600 mb-2">Recommendations</h3>
                    <ul className="text-sm space-y-1">
                      {accountHealth.recommendations.map((rec: string, index: number) => (
                        <li key={index} className="text-blue-600">• {rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Comprehensive Account Diagnosis */}
        {diagnosis && (
          <div className="bg-card p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Comprehensive Diagnosis</h2>
            <pre className="bg-muted p-3 rounded text-sm overflow-auto max-h-64">
              {JSON.stringify(diagnosis, null, 2)}
            </pre>
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
