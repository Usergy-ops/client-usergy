
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEnhancedClientAuth } from '@/contexts/EnhancedClientAuthContext';
import { ImprovedClientSignUpForm } from '@/components/client/ImprovedClientSignUpForm';
import { ImprovedOTPVerification } from '@/components/client/ImprovedOTPVerification';
import { ClientSignInForm } from '@/components/client/ClientSignInForm';

export default function ImprovedClientAuth() {
  const [showSignIn, setShowSignIn] = useState(true);
  const { user } = useEnhancedClientAuth();

  const handleSignUpSuccess = () => {
    // Handle successful sign up - could redirect or show success message
    console.log('Sign up successful');
  };

  return (
    <div className="container relative h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:px-0">
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex">
        <div className="absolute inset-0 bg-zinc-900" />
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg">
              &ldquo;This client portal is a game-changer. It has streamlined our project
              management and improved communication with our clients.&rdquo;
            </p>
            <cite className="flex items-center">
              <span className="text-sm opacity-70">Usergy Client</span>
            </cite>
          </blockquote>
        </div>
      </div>
      <div className="lg:p-8">
        <Card className="w-[380px] lg:max-w-[420px]">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">
              {showSignIn ? 'Sign In' : 'Create an account'}
            </CardTitle>
            <CardDescription>
              {showSignIn
                ? 'Enter your email below to sign in to your account'
                : 'Enter your email below to create your account'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            {user ? (
              <div className="text-center">
                <p>You are already signed in.</p>
              </div>
            ) : (
              <Tabs defaultValue={showSignIn ? 'sign-in' : 'sign-up'} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger
                    value="sign-in"
                    onClick={() => setShowSignIn(true)}
                  >
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger
                    value="sign-up"
                    onClick={() => setShowSignIn(false)}
                  >
                    Sign Up
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="sign-in">
                  <ClientSignInForm />
                </TabsContent>
                <TabsContent value="sign-up">
                  <ImprovedClientSignUpForm onSuccess={handleSignUpSuccess} />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
