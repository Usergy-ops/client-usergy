import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { ClientAccountDiagnostics } from '@/utils/clientAccountDiagnostics';

export default function Diagnostics() {
  const [userId, setUserId] = useState('');
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);
  const [rlsTestResults, setRlsTestResults] = useState<any[]>([]);
  const [isRepairing, setIsRepairing] = useState(false);

  const runDiagnostic = async () => {
    if (!userId) return;

    try {
      const result = await ClientAccountDiagnostics.runComprehensiveDiagnostic(userId);
      setDiagnosticResult(result);
    } catch (error) {
      console.error('Diagnostic error:', error);
      setDiagnosticResult({ success: false, error: 'Failed to run diagnostic' });
    }
  };

  const repairAccount = async () => {
    if (!userId) return;
    setIsRepairing(true);

    try {
      const result = await ClientAccountDiagnostics.repairClientAccount(userId);
      setDiagnosticResult(result);
    } catch (error) {
      console.error('Repair error:', error);
      setDiagnosticResult({ success: false, error: 'Failed to repair account' });
    } finally {
      setIsRepairing(false);
    }
  };

  const testRLSPolicies = async () => {
    if (!userId) return;
    
    try {
      const result = await ClientAccountDiagnostics.checkRLSPolicies(userId);
      
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

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Client Account Diagnostics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <label htmlFor="userId" className="text-sm font-medium">
              User ID:
            </label>
            <input
              type="text"
              id="userId"
              className="border rounded px-2 py-1 text-sm w-48"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
            <Button onClick={runDiagnostic} variant="outline" size="sm">
              Run Diagnostic
            </Button>
            <Button onClick={testRLSPolicies} variant="outline" size="sm">
              Test RLS
            </Button>
            <Button onClick={repairAccount} variant="outline" size="sm" disabled={isRepairing}>
              {isRepairing ? 'Repairing...' : 'Repair Account'}
            </Button>
          </div>

          {diagnosticResult && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Diagnostic Result:</h3>
              {diagnosticResult.success ? (
                <div className="space-y-1">
                  <p>
                    User Exists:{' '}
                    <Badge variant={diagnosticResult.userExists ? 'success' : 'destructive'}>
                      {diagnosticResult.userExists ? 'Yes' : 'No'}
                    </Badge>
                  </p>
                  <p>
                    Client Record Exists:{' '}
                    <Badge variant={diagnosticResult.hasClientRecord ? 'success' : 'destructive'}>
                      {diagnosticResult.hasClientRecord ? 'Yes' : 'No'}
                    </Badge>
                  </p>
                  <p>
                    Account Verified:{' '}
                    <Badge variant={diagnosticResult.isClientVerified ? 'success' : 'destructive'}>
                      {diagnosticResult.isClientVerified ? 'Yes' : 'No'}
                    </Badge>
                  </p>
                  {diagnosticResult.issues.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-md font-semibold">Issues:</h4>
                      <ul className="list-disc pl-5">
                        {diagnosticResult.issues.map((issue, index) => (
                          <li key={index} className="text-destructive">
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {diagnosticResult.recommendations.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-md font-semibold">Recommendations:</h4>
                      <ul className="list-disc pl-5">
                        {diagnosticResult.recommendations.map((recommendation, index) => (
                          <li key={index} className="text-muted-foreground">
                            {recommendation}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-destructive">Error: {diagnosticResult.error}</p>
              )}
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
        </CardContent>
      </Card>
    </div>
  );
}
