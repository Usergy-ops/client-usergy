
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, XCircle, Mail, Send, TestTube, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useEmailSystemTest } from '@/hooks/useEmailSystemTest';

interface TestResult {
  test: string;
  success: boolean;
  message: string;
  data?: any;
  timestamp: string;
}

export function EmailSystemTester() {
  const [testEmail, setTestEmail] = useState('');
  const [testOtpCode, setTestOtpCode] = useState('');
  const [results, setResults] = useState<TestResult[]>([]);
  const { toast } = useToast();
  const { testing, testEmailDelivery, testOTPResend, testOTPVerification } = useEmailSystemTest();

  const addResult = (test: string, success: boolean, message: string, data?: any) => {
    const result: TestResult = {
      test,
      success,
      message,
      data,
      timestamp: new Date().toISOString()
    };
    setResults(prev => [result, ...prev]);
    return result;
  };

  const runCompleteSignupTest = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address for testing.",
        variant: "destructive"
      });
      return;
    }

    try {
      toast({
        title: "Running Complete Signup Test",
        description: "Testing signup and email delivery...",
      });

      const result = await testEmailDelivery(testEmail);
      addResult('Complete Signup Flow', result.success, result.message, result.data);

      if (result.success) {
        toast({
          title: "Signup Test Successful",
          description: "Check your email for the OTP code, then test verification below.",
        });
      } else {
        toast({
          title: "Signup Test Failed",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Signup test error:', error);
      addResult('Complete Signup Flow', false, 'Test failed with exception', error);
      toast({
        title: "Test Error",
        description: "An error occurred during testing.",
        variant: "destructive"
      });
    }
  };

  const runOTPResendTest = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address for testing.",
        variant: "destructive"
      });
      return;
    }

    try {
      const result = await testOTPResend(testEmail);
      addResult('OTP Resend', result.success, result.message, result.data);

      if (result.success) {
        toast({
          title: "OTP Resend Successful",
          description: "A new verification code has been sent.",
        });
      } else {
        toast({
          title: "OTP Resend Failed",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('OTP resend test error:', error);
      addResult('OTP Resend', false, 'Resend test failed with exception', error);
    }
  };

  const runOTPVerificationTest = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address for testing.",
        variant: "destructive"
      });
      return;
    }

    if (!testOtpCode || testOtpCode.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter a valid 6-digit OTP code.",
        variant: "destructive"
      });
      return;
    }

    try {
      const result = await testOTPVerification(testEmail, testOtpCode);
      addResult('OTP Verification', result.success, result.message, result.data);

      if (result.success) {
        toast({
          title: "OTP Verification Successful",
          description: "The verification code was accepted.",
        });
      } else {
        toast({
          title: "OTP Verification Failed",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('OTP verification test error:', error);
      addResult('OTP Verification', false, 'Verification test failed with exception', error);
    }
  };

  const getResultIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="w-4 h-4 text-green-600" />
    ) : (
      <XCircle className="w-4 h-4 text-red-600" />
    );
  };

  const getResultBadge = (success: boolean) => {
    return (
      <Badge variant={success ? "default" : "destructive"}>
        {success ? "PASS" : "FAIL"}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TestTube className="w-5 h-5" />
            <span>Email System Testing</span>
          </CardTitle>
          <CardDescription>
            Comprehensive testing suite for the email delivery system and OTP verification flow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="testEmail">Test Email Address</Label>
            <Input
              id="testEmail"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="your-email@example.com"
              className="usergy-input"
            />
            <p className="text-xs text-muted-foreground">
              Enter a real email address to receive test verification emails
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="testOtpCode">OTP Code (for verification test)</Label>
            <Input
              id="testOtpCode"
              type="text"
              value={testOtpCode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setTestOtpCode(value);
              }}
              placeholder="123456"
              maxLength={6}
              className="usergy-input text-center font-mono tracking-widest"
            />
            <p className="text-xs text-muted-foreground">
              Enter the 6-digit code from your email to test verification
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button 
              onClick={runCompleteSignupTest}
              disabled={testing}
              className="usergy-btn-primary"
            >
              {testing ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  <span>Testing...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Send className="w-4 h-4" />
                  <span>Test Signup</span>
                </div>
              )}
            </Button>

            <Button 
              onClick={runOTPResendTest}
              disabled={testing}
              variant="outline"
            >
              {testing ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                  <span>Testing...</span>
                </div>
              ) : (
                'Test Resend'
              )}
            </Button>

            <Button 
              onClick={runOTPVerificationTest}
              disabled={testing}
              variant="outline"
            >
              {testing ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                  <span>Testing...</span>
                </div>
              ) : (
                'Test Verification'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Mail className="w-5 h-5" />
              <span>Test Results</span>
            </CardTitle>
            <CardDescription>
              Results from the email system tests (most recent first)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((result, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getResultIcon(result.success)}
                      <span className="font-medium">{result.test}</span>
                      {getResultBadge(result.success)}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  <p className="text-sm text-muted-foreground ml-6">
                    {result.message}
                  </p>
                  
                  {result.data && (
                    <details className="ml-6">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                        View raw data
                      </summary>
                      <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-auto">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </details>
                  )}
                  
                  {index < results.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-yellow-800">
            <AlertTriangle className="w-5 h-5" />
            <span>Testing Instructions</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-yellow-700 space-y-2">
          <p><strong>1. Test Signup:</strong> Enter your email and click "Test Signup" to receive an OTP</p>
          <p><strong>2. Check Email:</strong> Look for the 6-digit code in your inbox (check spam folder too)</p>
          <p><strong>3. Test Verification:</strong> Enter the OTP code and click "Test Verification"</p>
          <p><strong>4. Test Resend:</strong> Use "Test Resend" to get a new code if needed</p>
        </CardContent>
      </Card>
    </div>
  );
}
