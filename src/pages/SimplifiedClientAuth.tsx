
import React, { useState } from 'react';
import { SimpleClientSignUpForm } from '@/components/client/SimpleClientSignUpForm';
import { SimpleOTPVerification } from '@/components/client/SimpleOTPVerification';
import { ClientAuthProvider, useClientAuth } from '@/contexts/ClientAuthContext';

export default function SimplifiedClientAuth() {
  const [step, setStep] = useState<'signup' | 'verification' | 'signin'>('signup');
  const [signupData, setSignupData] = useState<{
    email: string;
  } | null>(null);

  const handleSignupSuccess = (email: string) => {
    setSignupData({ email });
    setStep('verification');
  };

  const handleBackToSignup = () => {
    setStep('signup');
    setSignupData(null);
  };

  const handleSwitchToSignIn = () => {
    setStep('signin');
    setSignupData(null);
  };

  const handleSwitchToSignUp = () => {
    setStep('signup');
    setSignupData(null);
  };

  return (
    <ClientAuthProvider>
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-2xl shadow-lg p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-foreground">
                {step === 'signin' ? 'Welcome Back' : 'Welcome to Usergy'}
              </h1>
              <p className="text-muted-foreground mt-2">
                {step === 'signup' ? 'Create your account to get started' : 
                 step === 'signin' ? 'Sign in to your account' :
                 'Verify your email to continue'}
              </p>
            </div>

            {/* Forms */}
            {step === 'signup' ? (
              <SimpleClientSignUpForm 
                onSuccess={handleSignupSuccess}
                onSwitchToSignIn={handleSwitchToSignIn}
              />
            ) : step === 'signin' ? (
              <SimpleClientSignInForm 
                onSwitchToSignUp={handleSwitchToSignUp}
              />
            ) : signupData ? (
              <SimpleOTPVerification
                email={signupData.email}
                onBack={handleBackToSignup}
              />
            ) : null}
          </div>
        </div>
      </div>
    </ClientAuthProvider>
  );
}

// Simple sign in form component
function SimpleClientSignInForm({ onSwitchToSignUp }: { onSwitchToSignUp: () => void }) {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn } = useClientAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn(formData.email, formData.password);
      if (!result.success) {
        setError(result.error || 'Sign in failed. Please try again.');
      }
    } catch (error) {
      setError('Sign in failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-2">
          Email Address
        </label>
        <input
          id="email"
          type="email"
          required
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Enter your email"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-2">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Enter your password"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50"
      >
        {isLoading ? 'Signing In...' : 'Sign In'}
      </button>

      <div className="text-center mt-4">
        <p className="text-sm text-muted-foreground">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToSignUp}
            className="text-primary hover:underline"
          >
            Sign up
          </button>
        </p>
      </div>
    </form>
  );
}
