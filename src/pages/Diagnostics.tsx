
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UnifiedClientService } from '@/services/UnifiedClientService';

interface DiagnosticResult {
  success: boolean;
  userId: string;
  userExists: boolean;
  hasClientRecord: boolean;
  isClientVerified: boolean;
  isProfileComplete: boolean;
  issues: string[];
  recommendations: string[];
}

export default function Diagnostics() {
  const [userId, setUserId] = useState('');
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);

  const runDiagnostic = async () => {
    if (!userId) return;
    setIsRunning(true);

    try {
      const issues: string[] = [];
      const recommendations: string[] = [];

      // Get comprehensive account status
      const statusResult = await UnifiedClientService.getAccountStatus(userId);
      
      if (!statusResult.success) {
        setDiagnosticResult({
          success: false,
          userId,
          userExists: false,
          hasClientRecord: false,
          isClientVerified: false,
          isProfileComplete: false,
          issues: ['Failed to get account status: ' + statusResult.error],
          recommendations: ['Check user ID and try again']
        });
        return;
      }

      const status = statusResult.data!;

      if (!status.isClient) {
        issues.push('User is not a client account');
        recommendations.push('Create client account record');
      }

      if (!status.hasClientRecord) {
        issues.push('Client record missing');
        recommendations.push('Repair client account');
      }

      if (status.accountType !== 'client') {
        issues.push('Account type is not set to client');
        recommendations.push('Update account type to client');
      }

      if (!status.isProfileComplete) {
        issues.push('Profile is incomplete');
        recommendations.push('Complete profile setup');
      }

      setDiagnosticResult({
        success: true,
        userId,
        userExists: !!status.email,
        hasClientRecord: status.hasClientRecord,
        isClientVerified: status.isClient,
        isProfileComplete: status.isProfileComplete || false,
        issues,
        recommendations
      });

    } catch (error) {
      console.error('Diagnostic error:', error);
      setDiagnosticResult({
        success: false,
        userId,
        userExists: false,
        hasClientRecord: false,
        isClientVerified: false,
        isProfileComplete: false,
        issues: ['Failed to run diagnostic'],
        recommendations: ['Please try again or contact support']
      });
    } finally {
      setIsRunning(false);
    }
  };

  const repairAccount = async () => {
    if (!userId) return;
    setIsRepairing(true);

    try {
      const result = await UnifiedClientService.repairClientAccount(userId);
      
      if (result.success) {
        // Run diagnostic again to update results
        await runDiagnostic();
      } else {
        console.error('Repair failed:', result.error);
      }
    } catch (error) {
      console.error('Repair error:', error);
    } finally {
      setIsRepairing(false);
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
            <Button onClick={runDiagnostic} variant="outline" size="sm" disabled={isRunning}>
              {isRunning ? 'Running...' : 'Run Diagnostic'}
            </Button>
            <Button onClick={repairAccount} variant="outline" size="sm" disabled={isRepairing || !diagnosticResult}>
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
                    <Badge variant={diagnosticResult.userExists ? 'default' : 'destructive'}>
                      {diagnosticResult.userExists ? 'Yes' : 'No'}
                    </Badge>
                  </p>
                  <p>
                    Client Record Exists:{' '}
                    <Badge variant={diagnosticResult.hasClientRecord ? 'default' : 'destructive'}>
                      {diagnosticResult.hasClientRecord ? 'Yes' : 'No'}
                    </Badge>
                  </p>
                  <p>
                    Account Verified:{' '}
                    <Badge variant={diagnosticResult.isClientVerified ? 'default' : 'destructive'}>
                      {diagnosticResult.isClientVerified ? 'Yes' : 'No'}
                    </Badge>
                  </p>
                  <p>
                    Profile Complete:{' '}
                    <Badge variant={diagnosticResult.isProfileComplete ? 'default' : 'destructive'}>
                      {diagnosticResult.isProfileComplete ? 'Yes' : 'No'}
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
                <p className="text-destructive">Error: {diagnosticResult.issues[0]}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
