
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { OTPVerification } from './OTPVerification';
import { SignupProgressIndicator } from './SignupProgressIndicator';

interface SignUpForm {
  companyName: string;
  contactFirstName: string;
  contactLastName: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

type View = 'signup-form' | 'otp-verification';
type SignupStatus = 'idle' | 'creating' | 'sending-email' | 'success' | 'error';

const initialFormState: SignUpForm = {
  companyName: '',
  contactFirstName: '',
  contactLastName: '',
  email: '',
  password: '',
};

const validateEmail = (email: string): boolean => {
  const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
  return regex.test(email);
};

const validatePassword = (password: string): boolean => {
  return password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
};

export function ClientSignUpForm() {
  const [formData, setFormData] = useState<SignUpForm>(initialFormState);
  const [error, setError] = useState<string>('');
  const [currentView, setCurrentView] = useState<View>('signup-form');
  const [signupStatus, setSignupStatus] = useState<SignupStatus>('idle');
  const [emailSent, setEmailSent] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);

  const updateFormData = (field: keyof SignUpForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateForm = (): boolean => {
    if (!formData.companyName || !formData.contactFirstName || !formData.contactLastName || !formData.email || !formData.password) {
      setError('Please fill in all required fields.');
      return false;
    }

    if (!validateEmail(formData.email)) {
      setError('Please enter a valid email address.');
      return false;
    }

    if (!validatePassword(formData.password)) {
      setError('Password must be at least 8 characters long and contain both letters and numbers.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    await performSignup();
  };

  const performSignup = async (isRetry = false) => {
    if (isRetry) {
      setRetryCount(prev => prev + 1);
    } else {
      setRetryCount(0);
    }

    setSignupStatus('creating');
    setError('');

    try {
      console.log('Starting client sign up process via edge function...');
      
      const { data, error: signUpError } = await supabase.functions.invoke('client-auth-handler/signup', {
        body: {
          email: formData.email,
          password: formData.password,
          companyName: formData.companyName,
          firstName: formData.contactFirstName,
          lastName: formData.contactLastName,
        }
      });

      if (signUpError) {
        console.error('Edge function signup error:', signUpError);
        setSignupStatus('error');
        
        if (signUpError.message?.includes('already exists') || signUpError.message?.includes('already registered')) {
          setError('An account with this email already exists. Please sign in instead.');
        } else if (signUpError.message?.includes('Password')) {
          setError('Password must be at least 8 characters long and contain both letters and numbers.');
        } else {
          setError(`Sign up failed: ${signUpError.message}`);
        }
        return;
      }

      if (data?.error) {
        console.error('Edge function returned error:', data.error);
        setSignupStatus('error');
        
        if (data.error.includes('already exists')) {
          setError('An account with this email already exists. Please sign in instead.');
        } else {
          setError(`Sign up failed: ${data.error}`);
        }
        return;
      }

      if (data?.success) {
        console.log('Sign up successful via edge function:', data);
        setSignupStatus('sending-email');
        
        // Simulate email sending delay for better UX
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setSignupStatus('success');
        setEmailSent(data.emailSent || false);
        
        // Show success for a moment before transitioning to OTP
        setTimeout(() => {
          setCurrentView('otp-verification');
        }, 1500);
      } else {
        console.error('Unexpected response from edge function:', data);
        setSignupStatus('error');
        setError('Sign up failed. Please try again.');
      }
      
    } catch (error) {
      console.error('Sign up error:', error);
      setSignupStatus('error');
      
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
          setError('Network error. Please check your connection and try again.');
        } else {
          setError(`Sign up failed: ${error.message}`);
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    }
  };

  const handleRetry = () => {
    performSignup(true);
  };

  if (currentView === 'otp-verification') {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Account Created Successfully!</h2>
          <p className="text-muted-foreground">
            {emailSent 
              ? "We've sent a verification code to your email address."
              : "Please enter the verification code to complete your registration."
            }
          </p>
        </div>
        
        <OTPVerification
          email={formData.email}
          password={formData.password}
          onSuccess={() => {
            console.log('OTP verification successful');
          }}
          onBack={() => setCurrentView('signup-form')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {signupStatus !== 'idle' && (
        <SignupProgressIndicator 
          status={signupStatus}
          message={
            signupStatus === 'creating' ? 'Creating your account...' :
            signupStatus === 'sending-email' ? 'Sending verification email...' :
            signupStatus === 'success' ? 'Account created successfully!' :
            signupStatus === 'error' ? 'Account creation failed' :
            undefined
          }
        />
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 animate-in slide-in-from-top-2">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-destructive font-medium">Error</p>
              <p className="text-sm text-destructive mt-1">{error}</p>
              {retryCount > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Retry attempt: {retryCount}
                </p>
              )}
              {(error.includes('network') || error.includes('unexpected error')) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  className="mt-3"
                  disabled={signupStatus === 'creating'}
                >
                  Try Again
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="companyName">Company Name *</Label>
          <Input
            id="companyName"
            type="text"
            value={formData.companyName}
            onChange={(e) => updateFormData('companyName', e.target.value)}
            placeholder="Your Company Ltd"
            className="usergy-input"
            required
            disabled={signupStatus === 'creating' || signupStatus === 'sending-email'}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="contactFirstName">Contact First Name *</Label>
          <Input
            id="contactFirstName"
            type="text"
            value={formData.contactFirstName}
            onChange={(e) => updateFormData('contactFirstName', e.target.value)}
            placeholder="John"
            className="usergy-input"
            required
            disabled={signupStatus === 'creating' || signupStatus === 'sending-email'}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="contactLastName">Contact Last Name *</Label>
          <Input
            id="contactLastName"
            type="text"
            value={formData.contactLastName}
            onChange={(e) => updateFormData('contactLastName', e.target.value)}
            placeholder="Doe"
            className="usergy-input"
            required
            disabled={signupStatus === 'creating' || signupStatus === 'sending-email'}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => updateFormData('email', e.target.value)}
            placeholder="john.doe@example.com"
            className="usergy-input"
            required
            disabled={signupStatus === 'creating' || signupStatus === 'sending-email'}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="password">Password *</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => updateFormData('password', e.target.value)}
            placeholder="Password"
            className="usergy-input"
            required
            disabled={signupStatus === 'creating' || signupStatus === 'sending-email'}
          />
          <p className="text-xs text-muted-foreground">
            Password must be at least 8 characters with letters and numbers
          </p>
        </div>
        
        <Button 
          type="submit" 
          className="w-full usergy-btn-primary"
          disabled={signupStatus === 'creating' || signupStatus === 'sending-email' || signupStatus === 'success'}
        >
          {signupStatus === 'creating' ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              <span>Creating Account...</span>
            </div>
          ) : signupStatus === 'sending-email' ? (
            <div className="flex items-center space-x-2">
              <Mail className="h-4 w-4" />
              <span>Sending Email...</span>
            </div>
          ) : signupStatus === 'success' ? (
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4" />
              <span>Account Created!</span>
            </div>
          ) : (
            'Create Account'
          )}
        </Button>
      </form>
    </div>
  );
}
