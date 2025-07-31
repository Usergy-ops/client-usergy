
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error' | 'warning';
  message: string;
  data?: any;
}

export function ClientAuthTestUtility() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const { user, diagnoseAccount, getAccountHealth } = useClientAuth();

  const addResult = (result: TestResult) => {
    setTestResults(prev => [...prev, result]);
  };

  const runComprehensiveTests = async () => {
    setIsRunning(true);
    setTestResults([]);

    try {
      // Test 1: Edge Function Accessibility
      addResult({ name: 'Testing Edge Function Access', status: 'pending', message: 'Checking if edge function is accessible...' });
      
      try {
        const { data, error } = await supabase.functions.invoke('client-auth-handler/signup', {
          body: { test: true }
        });
        
        if (error && error.message.includes('Invalid endpoint')) {
          addResult({ 
            name: 'Edge Function Access', 
            status: 'error', 
            message: 'Edge function not accessible or not deployed' 
          });
        } else {
          addResult({ 
            name: 'Edge Function Access', 
            status: 'success', 
            message: 'Edge function is accessible' 
          });
        }
      } catch (err) {
        addResult({ 
          name: 'Edge Function Access', 
          status: 'error', 
          message: `Edge function error: ${err instanceof Error ? err.message : 'Unknown error'}` 
        });
      }

      // Test 2: Database Connection
      addResult({ name: 'Testing Database Connection', status: 'pending', message: 'Testing database connectivity...' });
      
      try {
        const { data, error } = await supabase.from('account_types').select('count').limit(1);
        if (error) {
          addResult({ 
            name: 'Database Connection', 
            status: 'error', 
            message: `Database error: ${error.message}` 
          });
        } else {
          addResult({ 
            name: 'Database Connection', 
            status: 'success', 
            message: 'Database is accessible' 
          });
        }
      } catch (err) {
        addResult({ 
          name: 'Database Connection', 
          status: 'error', 
          message: `Database connection failed: ${err instanceof Error ? err.message : 'Unknown error'}` 
        });
      }

      // Test 3: OTP Table Access
      addResult({ name: 'Testing OTP Table', status: 'pending', message: 'Checking OTP verification table...' });
      
      try {
        const { data, error } = await supabase.from('user_otp_verification').select('count').limit(1);
        if (error) {
          addResult({ 
            name: 'OTP Table Access', 
            status: 'error', 
            message: `OTP table error: ${error.message}` 
          });
        } else {
          addResult({ 
            name: 'OTP Table Access', 
            status: 'success', 
            message: 'OTP table is accessible' 
          });
        }
      } catch (err) {
        addResult({ 
          name: 'OTP Table Access', 
          status: 'error', 
          message: `OTP table access failed: ${err instanceof Error ? err.message : 'Unknown error'}` 
        });
      }

      // Test 4: Auth State
      if (user) {
        addResult({ name: 'Current User Session', status: 'pending', message: 'Analyzing current user session...' });
        
        try {
          const health = await getAccountHealth(user.id);
          addResult({ 
            name: 'Account Health Check', 
            status: health.isClientVerified ? 'success' : 'warning',
            message: health.isClientVerified ? 'Client account is properly configured' : 'Client account needs attention',
            data: health
          });

          const diagnosis = await diagnoseAccount(user.id);
          addResult({ 
            name: 'Account Diagnosis', 
            status: diagnosis.is_client_account_result ? 'success' : 'error',
            message: diagnosis.is_client_account_result ? 'Account diagnosis passed' : 'Account diagnosis failed',
            data: diagnosis
          });
        } catch (err) {
          addResult({ 
            name: 'Account Analysis', 
            status: 'error', 
            message: `Account analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}` 
          });
        }
      } else {
        addResult({ 
          name: 'Current User Session', 
          status: 'warning', 
          message: 'No user currently signed in' 
        });
      }

      // Test 5: RPC Functions
      addResult({ name: 'Testing RPC Functions', status: 'pending', message: 'Testing database functions...' });
      
      if (user) {
        try {
          const { data: isClient, error } = await supabase.rpc('is_client_account', {
            user_id_param: user.id
          });

          if (error) {
            addResult({ 
              name: 'RPC Functions', 
              status: 'error', 
              message: `RPC function error: ${error.message}` 
            });
          } else {
            addResult({ 
              name: 'RPC Functions', 
              status: 'success', 
              message: `RPC functions working. User is ${isClient ? 'a client' : 'not a client'} account` 
            });
          }
        } catch (err) {
          addResult({ 
            name: 'RPC Functions', 
            status: 'error', 
            message: `RPC test failed: ${err instanceof Error ? err.message : 'Unknown error'}` 
          });
        }
      } else {
        addResult({ 
          name: 'RPC Functions', 
          status: 'warning', 
          message: 'Cannot test RPC functions without user session' 
        });
      }

      // Test 6: Email Configuration Check (via edge function)
      addResult({ name: 'Testing Email Configuration', status: 'pending', message: 'Checking email setup...' });
      
      try {
        // This will test if the edge function can access email configuration
        const { data, error } = await supabase.functions.invoke('client-auth-handler/signup', {
          body: {
            email: 'test@example.com',
            password: 'testpass123',
            companyName: 'Test Company',
            firstName: 'Test',
            lastName: 'User'
          }
        });
        
        if (data?.error && data.error.includes('already exists')) {
          addResult({ 
            name: 'Email Configuration', 
            status: 'success', 
            message: 'Email configuration appears to be working (user already exists response)' 
          });
        } else if (data?.success === false && data?.error) {
          if (data.error.includes('RESEND_API_KEY')) {
            addResult({ 
              name: 'Email Configuration', 
              status: 'warning', 
              message: 'RESEND_API_KEY not configured - emails will not be sent' 
            });
          } else {
            addResult({ 
              name: 'Email Configuration', 
              status: 'error', 
              message: `Email configuration issue: ${data.error}` 
            });
          }
        } else {
          addResult({ 
            name: 'Email Configuration', 
            status: 'warning', 
            message: 'Email configuration status unclear - check edge function logs' 
          });
        }
      } catch (err) {
        addResult({ 
          name: 'Email Configuration', 
          status: 'error', 
          message: `Email configuration test failed: ${err instanceof Error ? err.message : 'Unknown error'}` 
        });
      }

    } catch (error) {
      addResult({ 
        name: 'Test Suite', 
        status: 'error', 
        message: `Test suite failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'pending': return <Clock className="w-4 h-4 text-blue-600 animate-spin" />;
    }
  };

  const getStatusBadgeVariant = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return 'success' as const;
      case 'error': return 'destructive' as const;
      case 'warning': return 'secondary' as const;
      case 'pending': return 'outline' as const;
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Client Authentication Test Utility</CardTitle>
        <CardDescription>
          Comprehensive testing for the client authentication flow including edge functions, database connectivity, and account setup.
        </CardDescription>
        
        <div className="flex items-center justify-between pt-4">
          <Button 
            onClick={runComprehensiveTests} 
            disabled={isRunning}
            className="usergy-btn-primary"
          >
            {isRunning ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                <span>Running Tests...</span>
              </div>
            ) : (
              'Run Comprehensive Tests'
            )}
          </Button>
          
          {testResults.length > 0 && (
            <div className="flex space-x-2">
              <Badge variant="outline">
                {testResults.filter(r => r.status === 'success').length} Passed
              </Badge>
              <Badge variant="destructive">
                {testResults.filter(r => r.status === 'error').length} Failed
              </Badge>
              <Badge variant="secondary">
                {testResults.filter(r => r.status === 'warning').length} Warnings
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {testResults.length === 0 && !isRunning && (
          <div className="text-center py-8 text-muted-foreground">
            Click "Run Comprehensive Tests" to begin testing the authentication system.
          </div>
        )}
        
        <div className="space-y-3">
          {testResults.map((result, index) => (
            <div 
              key={index}
              className="flex items-start space-x-3 p-3 rounded-lg border bg-card"
            >
              {getStatusIcon(result.status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <h4 className="font-medium text-sm">{result.name}</h4>
                  <Badge variant={getStatusBadgeVariant(result.status)} className="text-xs">
                    {result.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
                {result.data && (
                  <details className="mt-2">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      Show Details
                    </summary>
                    <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-auto">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {testResults.length > 0 && !isRunning && (
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium text-sm mb-2">Test Summary</h4>
            <div className="text-sm text-muted-foreground">
              <p>Total Tests: {testResults.length}</p>
              <p>Passed: {testResults.filter(r => r.status === 'success').length}</p>
              <p>Failed: {testResults.filter(r => r.status === 'error').length}</p>
              <p>Warnings: {testResults.filter(r => r.status === 'warning').length}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
