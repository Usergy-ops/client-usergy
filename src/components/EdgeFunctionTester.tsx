
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { testEdgeFunctionEndpoints, testCORS } from '@/utils/edgeFunctionTests';
import { CheckCircle, XCircle, Loader2, Play } from 'lucide-react';

interface TestResult {
  success: boolean;
  data?: any;
  error?: any;
  status?: number;
}

interface TestResults {
  signup?: TestResult;
  resend?: TestResult;
  otp?: TestResult;
  cors?: TestResult;
}

export function EdgeFunctionTester() {
  const [results, setResults] = useState<TestResults>({});
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');

  const runTest = async (testName: string, testFunction: () => Promise<any>) => {
    setCurrentTest(testName);
    try {
      const result = await testFunction();
      setResults(prev => ({ ...prev, [testName]: result }));
    } catch (error) {
      setResults(prev => ({ ...prev, [testName]: { success: false, error } }));
    }
    setCurrentTest('');
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setResults({});
    
    try {
      // Test CORS first
      await runTest('cors', async () => {
        const success = await testCORS();
        return { success };
      });
      
      // Test signup
      await runTest('signup', testEdgeFunctionEndpoints.testSignup);
      
      // Test resend
      await runTest('resend', testEdgeFunctionEndpoints.testResendOTP);
      
      // Test OTP verification
      await runTest('otp', testEdgeFunctionEndpoints.testOTPVerification);
      
    } catch (error) {
      console.error('Test suite failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (result?: TestResult) => {
    if (!result) return null;
    return result.success ? 
      <CheckCircle className="w-5 h-5 text-green-600" /> : 
      <XCircle className="w-5 h-5 text-red-600" />;
  };

  const getStatusBadge = (result?: TestResult) => {
    if (!result) return <Badge variant="outline">Not Run</Badge>;
    return result.success ? 
      <Badge variant="default" className="bg-green-600">PASS</Badge> : 
      <Badge variant="destructive">FAIL</Badge>;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Play className="w-5 h-5" />
            <span>Edge Function Test Suite</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-4">
            <Button 
              onClick={runAllTests} 
              disabled={isRunning}
              className="usergy-btn-primary"
            >
              {isRunning ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Running Tests...</span>
                </div>
              ) : (
                'Run All Tests'
              )}
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => window.open('https://supabase.com/dashboard/project/lnsyrmpucmllakuuiixe/functions/client-auth-handler/logs', '_blank')}
            >
              View Edge Function Logs
            </Button>
          </div>

          {currentTest && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Running {currentTest} test...</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CORS Configuration</CardTitle>
            {getStatusIcon(results.cors)}
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm">Preflight requests</span>
              {getStatusBadge(results.cors)}
            </div>
            {results.cors?.error && (
              <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                {results.cors.error.toString()}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Signup Endpoint</CardTitle>
            {getStatusIcon(results.signup)}
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm">POST /signup</span>
              {getStatusBadge(results.signup)}
            </div>
            {results.signup?.status && (
              <div className="mt-1 text-xs text-muted-foreground">
                Status: {results.signup.status}
              </div>
            )}
            {results.signup?.error && (
              <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                {results.signup.error.toString()}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resend OTP</CardTitle>
            {getStatusIcon(results.resend)}
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm">POST /resend-otp</span>
              {getStatusBadge(results.resend)}
            </div>
            {results.resend?.status && (
              <div className="mt-1 text-xs text-muted-foreground">
                Status: {results.resend.status}
              </div>
            )}
            {results.resend?.error && (
              <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                {results.resend.error.toString()}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">OTP Verification</CardTitle>
            {getStatusIcon(results.otp)}
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm">POST /verify-otp</span>
              {getStatusBadge(results.otp)}
            </div>
            {results.otp?.status && (
              <div className="mt-1 text-xs text-muted-foreground">
                Status: {results.otp.status}
              </div>
            )}
            {results.otp?.error && (
              <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                {results.otp.error.toString()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Browser Console Testing:</h4>
            <div className="bg-gray-100 p-3 rounded text-sm font-mono">
              <div>// Open browser console and paste:</div>
              <div>testEdgeFunctionEndpoints.runAllTests();</div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Manual Curl Testing:</h4>
            <div className="bg-gray-100 p-3 rounded text-xs font-mono">
              <div># Test signup endpoint</div>
              <div>curl -X POST https://lnsyrmpucmllakuuiixe.supabase.co/functions/v1/client-auth-handler/signup \</div>
              <div>  -H "Content-Type: application/json" \</div>
              <div>  -d '{"{"}email": "test@client.usergy.ai", "password": "TestPass123!"{"}"}'</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
