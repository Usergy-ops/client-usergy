
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, XCircle, Mail, Send, TestTube, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

interface TestResult {
  test: string;
  success: boolean;
  message: string;
  data?: any;
  timestamp: string;
}

export function EmailSystemTester() {
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const { toast } = useToast();

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

  const testEdgeFunctionConnectivity = async (): Promise<TestResult> => {
    try {
      console.log('Testing unified-auth edge function connectivity...');
      
      const { data, error } = await supabase.functions.invoke('unified-auth', {
        body: { 
          action: 'signup',
          email: 'test@example.com',
          password: 'test123',
          companyName: 'Test Company',
          firstName: 'Test',
          lastName: 'User',
          accountType: 'client',
          sourceUrl: window.location.origin
        }
      });

      if (error) {
        return addResult('Edge Function', false, `Edge function error: ${error.message}`, error);
      }

      return addResult('Edge Function', true, 'Edge function is accessible and responding', data);
    } catch (error) {
      console.error('Edge function connectivity test error:', error);
      return addResult('Edge Function', false, `Connectivity failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    }
  };

  const testEmailConfiguration = async (): Promise<TestResult> => {
    try {
      console.log('Testing email configuration...');
      
      // Test with a real email signup to check if Resend is configured
      const { data, error } = await supabase.functions.invoke('unified-auth', {
        body: { 
          action: 'signup',
          email: testEmail || 'noreply@example.com',
          password: 'test123456',
          companyName: 'Email Test Company',
          firstName: 'Email',
          lastName: 'Test',
          accountType: 'client',
          sourceUrl: window.location.origin
        }
      });

      if (error) {
        return addResult('Email Config', false, `Email configuration test failed: ${error.message}`, error);
      }

      if (data?.success) {
        return addResult('Email Config', true, `Email system working. Email sent: ${data.emailSent || false}`, data);
      }

      return addResult('Email Config', false, 'Email configuration may have issues', data);
    } catch (error) {
      console.error('Email configuration test error:', error);
      return addResult('Email Config', false, `Configuration test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    }
  };

  const testCompleteSignupFlow = async (): Promise<TestResult> => {
    if (!testEmail || !testEmail.includes('@')) {
      return addResult('Signup Flow', false, 'Valid test email required for signup flow test');
    }

    try {
      console.log('Testing complete signup flow for:', testEmail);
      
      // Test the complete signup process
      const { data, error } = await supabase.functions.invoke('unified-auth', {
        body: { 
          action: 'signup',
          email: testEmail,
          password: 'TestPassword123',
          companyName: 'Flow Test Company',
          firstName: 'Flow',
          lastName: 'Test',
          accountType: 'client',
          sourceUrl: window.location.origin
        }
      });

      if (error) {
        return addResult('Signup Flow', false, `Signup flow failed: ${error.message}`, error);
      }

      if (data?.success) {
        const message = data.emailSent 
          ? 'Complete signup flow successful - verification email sent!' 
          : 'Signup completed but email sending may have failed';
        
        return addResult('Signup Flow', data.emailSent || false, message, data);
      }

      return addResult('Signup Flow', false, 'Signup flow completed with issues', data);
    } catch (error) {
      console.error('Complete signup flow test error:', error);
      return addResult('Signup Flow', false, `Flow test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    }
  };

  const testOTPResend = async (): Promise<TestResult> => {
    if (!testEmail || !testEmail.includes('@')) {
      return addResult('OTP Resend', false, 'Valid test email required for OTP resend test');
    }

    try {
      console.log('Testing OTP resend for:', testEmail);
      
      const { data, error } = await supabase.functions.invoke('unified-auth', {
        body: { 
          action: 'resend-otp',
          email: testEmail
        }
      });

      if (error) {
        return addResult('OTP Resend', false, `OTP resend failed: ${error.message}`, error);
      }

      if (data?.success) {
        const message = data.emailSent 
          ? 'OTP resend successful - new code sent!' 
          : 'OTP generated but email sending may have failed';
        
        return addResult('OTP Resend', data.emailSent || false, message, data);
      }

      return addResult('OTP Resend', false, 'OTP resend completed with issues', data);
    } catch (error) {
      console.error('OTP resend test error:', error);
      return addResult('OTP Resend', false, `Resend test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    }
  };

  const runAllTests = async () => {
    setTesting(true);
    setResults([]);
    
    try {
      toast({
        title: "Running Email System Tests",
        description: "Testing all components of the email delivery system...",
      });

      // Run tests in sequence
      await testEdgeFunctionConnectivity();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Brief delay between tests
      
      await testEmailConfiguration();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await testCompleteSignupFlow();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await testOTPResend();

      toast({
        title: "Tests Completed",
        description: "Check the results below for detailed information.",
      });
    } catch (error) {
      console.error('Test suite error:', error);
      toast({
        title: "Test Suite Error",
        description: "An error occurred while running tests.",
        variant: "destructive"
      });
    } finally {
      setTesting(false);
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
          
          <Button 
            onClick={runAllTests}
            disabled={testing}
            className="w-full usergy-btn-primary"
          >
            {testing ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                <span>Running Tests...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Send className="w-4 h-4" />
                <span>Run Complete Test Suite</span>
              </div>
            )}
          </Button>
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
            <span>Important Notes</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-yellow-700 space-y-2">
          <p>• Make sure your domain is verified in Resend if using a custom from address</p>
          <p>• Check spam/junk folders if test emails don't arrive in inbox</p>
          <p>• Email delivery may take 30-60 seconds in some cases</p>
          <p>• Use a real email address you can access for accurate testing</p>
        </CardContent>
      </Card>
    </div>
  );
}
