import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { EnhancedOTPVerification } from './EnhancedOTPVerification';

interface SignUpForm {
  companyName: string;
  contactFirstName: string;
  contactLastName: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

type View = 'signup-form' | 'otp-verification';

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
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<View>('signup-form');

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
    
    setIsSubmitting(true);
    setError('');

    try {
      console.log('Starting client sign up process...');
      
      const { error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            account_type: 'client',
            accountType: 'client',
            companyName: formData.companyName,
            contactFirstName: formData.contactFirstName,
            contactLastName: formData.contactLastName,
            full_name: `${formData.contactFirstName} ${formData.contactLastName}`.trim()
          }
        }
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('An account with this email already exists. Please sign in instead.');
        } else if (signUpError.message.includes('Password')) {
          setError('Password must be at least 8 characters long and contain both letters and numbers.');
        } else {
          setError(`Sign up failed: ${signUpError.message}`);
        }
        return;
      }

      console.log('Sign up successful, showing OTP verification');
      setCurrentView('otp-verification');
      
    } catch (error) {
      console.error('Sign up error:', error);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (currentView === 'otp-verification') {
    return (
      <EnhancedOTPVerification
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 animate-in slide-in-from-top-2">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <p className="text-sm text-destructive font-medium">Error</p>
          </div>
          <p className="text-sm text-destructive mt-1">{error}</p>
        </div>
      )}
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
        />
      </div>
      <Button 
        type="submit" 
        className="w-full usergy-btn-primary"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            <span>Creating Account...</span>
          </div>
        ) : (
          'Create Account'
        )}
      </Button>
    </form>
  );
}
