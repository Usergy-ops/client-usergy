
import { useState } from 'react';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Mail, Lock, Building, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { OTPVerification } from './OTPVerification';
import { useToast } from '@/hooks/use-toast';
import { useErrorLogger } from '@/hooks/useErrorLogger';

export function ClientSignUpForm() {
  const { signInWithGoogle } = useClientAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const { toast } = useToast();
  const { logAuthError } = useErrorLogger();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    companyName: '',
    contactFirstName: '',
    contactLastName: '',
  });

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleGoogleSignUp = async () => {
    try {
      setLoading(true);
      setError('');
      
      const { error } = await signInWithGoogle();

      if (error) {
        await logAuthError(error, 'google_signup');
        setError('Failed to authenticate with Google. Please try again.');
      }
    } catch (error) {
      await logAuthError(error, 'google_signup_exception');
      setError('An unexpected error occurred with Google authentication');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password || !formData.companyName || !formData.contactFirstName || !formData.contactLastName) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const { data, error } = await supabase.functions.invoke('client-auth-handler/signup', {
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          companyName: formData.companyName,
          firstName: formData.contactFirstName,
          lastName: formData.contactLastName
        })
      });

      if (error) {
        await logAuthError(error, 'email_signup');
        setError(error.message || 'Failed to create account. Please try again.');
        return;
      }

      if (data && data.success) {
        setShowOTPVerification(true);
        
        toast({
          title: "Account created!",
          description: "Please check your email for the verification code.",
        });
      } else {
        await logAuthError(
          new Error(data?.error || 'Signup failed'),
          'email_signup_failed'
        );
        setError(data?.error || 'Failed to create account. Please try again.');
      }
    } catch (error) {
      await logAuthError(error, 'email_signup_exception');
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPSuccess = () => {
    toast({
      title: "Welcome to Usergy!",
      description: "Your account has been created successfully.",
    });
  };

  const handleBackToSignup = () => {
    setShowOTPVerification(false);
  };

  if (showOTPVerification) {
    return (
      <OTPVerification
        email={formData.email}
        onSuccess={handleOTPSuccess}
        onBack={handleBackToSignup}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 animate-in slide-in-from-top-2">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleGoogleSignUp}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 px-6 py-3 border border-border bg-white hover:bg-gray-50 rounded-xl font-medium text-foreground transition-all duration-300 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">or continue with email</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium">Your email address</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => updateFormData('email', e.target.value)}
            placeholder="explorer@company.com"
            className="pl-10 usergy-input"
            required
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-medium">Create your password (8+ characters)</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={(e) => updateFormData('password', e.target.value)}
            placeholder="Create a strong password"
            className="pl-10 pr-10 usergy-input"
            required
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            disabled={loading}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="companyName" className="text-sm font-medium">Company Name</Label>
        <div className="relative">
          <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            id="companyName"
            value={formData.companyName}
            onChange={(e) => updateFormData('companyName', e.target.value)}
            placeholder="Your Company Ltd"
            className="pl-10 usergy-input"
            required
            disabled={loading}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contactFirstName" className="text-sm font-medium">First Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              id="contactFirstName"
              value={formData.contactFirstName}
              onChange={(e) => updateFormData('contactFirstName', e.target.value)}
              placeholder="John"
              className="pl-10 usergy-input"
              required
              disabled={loading}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactLastName" className="text-sm font-medium">Last Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              id="contactLastName"
              value={formData.contactLastName}
              onChange={(e) => updateFormData('contactLastName', e.target.value)}
              placeholder="Doe"
              className="pl-10 usergy-input"
              required
              disabled={loading}
            />
          </div>
        </div>
      </div>

      <Button 
        type="submit"
        className="w-full usergy-btn-primary"
        disabled={loading || !formData.email || !formData.password || !formData.companyName || !formData.contactFirstName || !formData.contactLastName}
      >
        {loading ? (
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            <span>Creating Account...</span>
          </div>
        ) : (
          'Start Your Journey'
        )}
      </Button>
    </form>
  );
}
