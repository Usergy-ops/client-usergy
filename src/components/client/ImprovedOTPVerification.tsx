
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Mail, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface ImprovedOTPVerificationProps {
  email: string;
  password?: string;
  onBack: () => void;
}

export function ImprovedOTPVerification({ email, password, onBack }: ImprovedOTPVerificationProps) {
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on input
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otpCode.length !== 6 || !password) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('Starting unified auth OTP verification...');
      
      const { data, error } = await supabase.functions.invoke('unified-auth', {
        body: { 
          action: 'verify-otp',
          email, 
          otpCode, 
          password 
        }
      });
      
      if (error || !data?.success) {
        console.error('Unified auth OTP verification failed:', error || data?.error);
        setError(data?.error || error?.message || 'Invalid verification code. Please try again.');
        return;
      }

      if (data?.session) {
        console.log('OTP verification successful, setting session');
        
        // Set the session manually since we got it from the edge function
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });

        setSuccess(true);
        toast({
          title: "Email Verified!",
          description: "Your account has been created successfully.",
        });
        
        // Wait a moment for the success animation
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      } else {
        setError('Verification successful but session creation failed. Please try signing in.');
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setResendLoading(true);
    setError('');
    
    try {
      console.log('Starting unified auth OTP resend...');
      
      const { data, error } = await supabase.functions.invoke('unified-auth', {
        body: { 
          action: 'resend-otp',
          email
        }
      });
      
      if (error || !data?.success) {
        setError('Failed to resend code. Please try again.');
      } else {
        toast({
          title: "Code Resent!",
          description: "A new verification code has been sent to your email.",
        });
        setOtpCode('');
      }
    } catch (error) {
      console.error('Resend error:', error);
      setError('Network error. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center space-y-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Account Created!</h2>
          <p className="text-muted-foreground mt-2">
            Welcome to Usergy! Redirecting you to your dashboard...
          </p>
        </div>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Verify Your Email</h2>
        <p className="text-muted-foreground">
          We've sent a 6-digit verification code to <strong>{email}</strong>
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 animate-in slide-in-from-top-2">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">Verification Failed</p>
              <p className="text-sm text-destructive mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* OTP Form */}
      <form onSubmit={handleVerify} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="otp" className="text-sm font-medium">Verification Code</Label>
          <Input
            ref={inputRef}
            id="otp"
            type="text"
            value={otpCode}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 6);
              setOtpCode(value);
              if (error) setError('');
            }}
            placeholder="Enter 6-digit code"
            className="text-center text-lg font-mono tracking-widest usergy-input"
            maxLength={6}
            required
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground text-center">
            Enter the code from your email
          </p>
        </div>

        <Button 
          type="submit" 
          className="w-full usergy-btn-primary"
          disabled={loading || otpCode.length !== 6}
        >
          {loading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              <span>Verifying...</span>
            </div>
          ) : (
            'Verify & Create Account'
          )}
        </Button>

        {/* Resend Section */}
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Didn't receive the code?
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={handleResendOTP}
            disabled={resendLoading || loading}
            className="w-full"
          >
            {resendLoading ? (
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Sending...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-4 h-4" />
                <span>Resend Code</span>
              </div>
            )}
          </Button>
        </div>

        {/* Back Button */}
        <div className="text-center">
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground"
            disabled={loading}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sign Up
          </Button>
        </div>
      </form>

      {/* Help Text */}
      <div className="bg-muted/30 rounded-lg p-4 text-center">
        <p className="text-xs text-muted-foreground">
          If you continue having issues, please check your spam folder or contact support.
        </p>
      </div>
    </div>
  );
}
