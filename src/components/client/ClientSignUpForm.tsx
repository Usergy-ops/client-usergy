
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { StreamlinedOTPVerification } from './StreamlinedOTPVerification';
import { SignupProgressIndicator } from './SignupProgressIndicator';

interface SignUpForm {
  companyName: string;
  contactFirstName: string;
  contactLastName: string;
  email: string;
  password: string;
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
    
    setSignupStatus('creating');
    setError('');

    try {
      console.log('Using unified auth for client sign up process...');
      
      const { data, error: signUpError } = await supabase.functions.invoke('unified-auth', {
        body: {
          action: 'signup',
          email: formData.email,
          password: formData.password,
          companyName: formData.companyName,
          firstName: formData.contactFirstName,
          lastName: formData.contactLastName,
          accountType: 'client',
          sourceUrl: window.location.origin
        }
      });

      if (signUpError) {
        console.error('Unified auth sign up error:', signUpError);
        setSignupStatus('error');
        
        if (signUpError.message?.includes('already exists')) {
          setError('An account with this email already exists. Please sign in instead.');
        } else {
          setError(`Sign up failed: ${signUpError.message}`);
        }
        return;
      }

      if (data?.error) {
        console.error('Unified auth sign up response error:', data.error);
        setSignupStatus('error');
        
        if (data.error.includes('already exists')) {
          setError('An account with this email already exists. Please sign in instead.');
        } else {
          setError(`Sign up failed: ${data.error}`);
        }
        return;
      }

      if (data?.success) {
        console.log('Unified auth sign up successful:', data);
        setSignupStatus('sending-email');
        
        // Brief delay for better UX
        setTimeout(() => {
          setSignupStatus('success');
          setEmailSent(data.emailSent || false);
          
          // Transition to OTP verification
          setTimeout(() => {
            setCurrentView('otp-verification');
          }, 1000);
        }, 1000);
      } else {
        console.error('Unexpected response:', data);
        setSignupStatus('error');
        setError('Sign up failed. Please try again.');
      }
      
    } catch (error) {
      console.error('Sign up exception:', error);
      setSignupStatus('error');
      setError('An unexpected error occurred. Please try again.');
    }
  };

  if (currentView === 'otp-verification') {
    return (
      <StreamlinedOTPVerification
        email={formData.email}
        password={formData.password}
        onSuccess={() => {
          console.log('OTP verification successful');
        }}
        onBack={() => setCurrentView('signup-form')}
      />
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
