
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { supabase } from '@/lib/supabase';
import { Loader2, User, Mail, Key } from 'lucide-react';

export function ClientAuthTestUtility() {
  const { user, session, loading, isClientAccount, signUp, signIn, signOut } = useClientAuth();
  const [testEmail, setTestEmail] = useState('test@example.com');
  const [testPassword, setTestPassword] = useState('TestPassword123!');
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [message, setMessage] = useState('');
  const [dbTestResult, setDbTestResult] = useState<any>(null);

  const handleTestSignUp = async () => {
    setIsSigningUp(true);
    setMessage('');
    
    try {
      const result = await signUp(testEmail, testPassword, { companyName: 'Test Company' });
      
      if (result.success) {
        if (result.emailSent) {
          setMessage('Sign up successful! Check your email for verification.');
        } else {
          setMessage('Sign up successful! You are now logged in.');
        }
      } else {
        setMessage(`Sign up failed: ${result.error}`);
      }
    } catch (error) {
      setMessage(`Sign up error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSigningUp(false);
    }
  };

  const handleTestSignIn = async () => {
    setIsSigningIn(true);
    setMessage('');
    
    try {
      const result = await signIn(testEmail, testPassword);
      
      if (result.success) {
        setMessage('Sign in successful!');
      } else {
        setMessage(`Sign in failed: ${result.error}`);
      }
    } catch (error) {
      setMessage(`Sign in error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSigningIn(false);
    }
  };

  const testDatabaseConnection = async () => {
    try {
      // Test basic connection
      const { data: accountTypes, error: accountError } = await supabase
        .from('account_types')
        .select('*')
        .limit(1);

      // Test client function
      const { data: isClient, error: clientError } = await supabase
        .rpc('is_client_account', { user_id_param: user?.id || '00000000-0000-0000-0000-000000000000' });

      setDbTestResult({
        accountTypesTest: { success: !accountError, data: accountTypes, error: accountError?.message },
        clientFunctionTest: { success: !clientError, data: isClient, error: clientError?.message },
        timestamp: new Date().toLocaleTimeString()
      });
    } catch (error) {
      setDbTestResult({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toLocaleTimeString()
      });
    }
  };

  return (
    <div className="space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Client Auth Test Utility</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Auth State */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Current State</h3>
              <div className="text-sm space-y-1">
                <div>Loading: {loading ? '✅' : '❌'}</div>
                <div>User: {user ? '✅' : '❌'}</div>
                <div>Session: {session ? '✅' : '❌'}</div>
                <div>Client Account: {isClientAccount ? '✅' : '❌'}</div>
                {user && <div>Email: {user.email}</div>}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">Test Credentials</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4" />
                  <Input
                    type="email"
                    placeholder="Test email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="flex-1"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Key className="w-4 h-4" />
                  <Input
                    type="password"
                    placeholder="Test password"
                    value={testPassword}
                    onChange={(e) => setTestPassword(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleTestSignUp}
              disabled={isSigningUp || loading}
              variant="default"
            >
              {isSigningUp && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Test Sign Up
            </Button>

            <Button
              onClick={handleTestSignIn}
              disabled={isSigningIn || loading}
              variant="outline"
            >
              {isSigningIn && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Test Sign In
            </Button>

            <Button
              onClick={testDatabaseConnection}
              variant="outline"
            >
              Test DB Connection
            </Button>

            {user && (
              <Button
                onClick={signOut}
                variant="destructive"
              >
                Sign Out
              </Button>
            )}
          </div>

          {/* Messages */}
          {message && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">{message}</p>
            </div>
          )}

          {/* Database Test Results */}
          {dbTestResult && (
            <div className="p-3 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Database Test Results ({dbTestResult.timestamp})</h4>
              {dbTestResult.error ? (
                <p className="text-destructive text-sm">{dbTestResult.error}</p>
              ) : (
                <div className="space-y-2 text-sm">
                  <div>
                    Account Types Query: {dbTestResult.accountTypesTest.success ? '✅' : '❌'}
                    {dbTestResult.accountTypesTest.error && ` - ${dbTestResult.accountTypesTest.error}`}
                  </div>
                  <div>
                    Client Function: {dbTestResult.clientFunctionTest.success ? '✅' : '❌'}
                    {dbTestResult.clientFunctionTest.error && ` - ${dbTestResult.clientFunctionTest.error}`}
                  </div>
                  {user && (
                    <div>
                      Is Client: {dbTestResult.clientFunctionTest.data ? '✅' : '❌'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
