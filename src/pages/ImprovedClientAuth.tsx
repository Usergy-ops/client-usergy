
import React, { useState } from 'react';
import { ImprovedClientSignUpForm } from '@/components/client/ImprovedClientSignUpForm';
import { ImprovedOTPVerification } from '@/components/client/ImprovedOTPVerification';
import { EnhancedClientAuthProvider } from '@/contexts/EnhancedClientAuthContext';

export default function ImprovedClientAuth() {
  const [step, setStep] = useState<'signup' | 'verification'>('signup');
  const [signupData, setSignupData] = useState<{
    email: string;
    password: string;
  } | null>(null);

  const handleSignupSuccess = (email: string, password: string) => {
    setSignupData({ email, password });
    setStep('verification');
  };

  const handleBackToSignup = () => {
    setStep('signup');
    setSignupData(null);
  };

  return (
    <EnhancedClientAuthProvider>
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-2xl shadow-lg p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-foreground">Welcome to Usergy</h1>
              <p className="text-muted-foreground mt-2">
                {step === 'signup' ? 'Create your account to get started' : 'Verify your email to continue'}
              </p>
            </div>

            {/* Forms */}
            {step === 'signup' ? (
              <ImprovedClientSignUpForm onSuccess={handleSignupSuccess} />
            ) : signupData ? (
              <ImprovedOTPVerification
                email={signupData.email}
                password={signupData.password}
                onBack={handleBackToSignup}
              />
            ) : null}

            {/* Footer */}
            <div className="text-center mt-8 pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Already have an account?{' '}
                <a href="/signin" className="text-primary hover:underline">
                  Sign in
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </EnhancedClientAuthProvider>
  );
}
