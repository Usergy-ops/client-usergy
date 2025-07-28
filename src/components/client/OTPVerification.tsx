
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Mail, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { useNavigate } from 'react-router-dom';

interface OTPVerificationProps {
  email: string;
  onSuccess: () => void;
  onBack: () => void;
}

export function OTPVerification({ email, onSuccess, onBack }: OTPVerificationProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const { toast } = useToast();
  const { refreshSession } = useClientAuth();
  const navigate = useNavigate();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!otpCode || otpCode.length !== 6) {
      setError('Please enter a valid 6-digit verification code');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      console.log('Verifying OTP for:', email);
      
      const { data, error } = await supabase.functions.invoke('client-auth-handler/verify-otp', {
        body: { 
          email,
          otpCode 
        }
      });

      console.log('OTP verification response:', { data, error });

      if (error) {
        console.error('OTP verification failed:', error);
        setError('Invalid verification code. Please try again.');
        return;
      }

      if (data && data.success) {
        console.log('OTP verification successful');
        
        toast({
          title: "Email verified successfully!",
          description: "Setting up your account...",
        });
        
        // Refresh session to trigger the account creation process
        await refreshSession();
        
        onSuccess();
        
        // Wait a bit for the account creation to complete before navigating
        setTimeout(() => {
          console.log('Navigating to dashboard...');
          navigate('/dashboard', { replace: true });
        }, 2000);
        
      } else {
        console.error('OTP verification failed:', data);
        setError(data?.error || 'Invalid verification code. Please try again.');
      }
    } catch (error) {
      console.error('OTP verification exception:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendLoading(true);
    setError('');
    
    try {
      console.log('Resending OTP for:', email);
      
      const { data, error } = await supabase.functions.invoke('client-auth-handler/resend-otp', {
        body: { email }
      });

      console.log('Resend OTP response:', { data, error });

      if (error) {
        console.error('Resend OTP error:', error);
        setError('Failed to resend verification code. Please try again.');
      } else if (data && data.success) {
        toast({
          title: "Code resent!",
          description: "A new verification code has been sent to your email.",
        });
        setOtpCode('');
      } else {
        setError('Failed to resend verification code. Please try again.');
      }
    } catch (error) {
      console.error('Resend OTP exception:', error);
      setError('Failed to resend verification code. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Check Your Email</h2>
        <p className="text-muted-foreground">
          We've sent a 6-digit verification code to <strong>{email}</strong>
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 animate-in slide-in-from-top-2">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="otp" className="text-sm font-medium">Verification Code</Label>
          <Input
            id="otp"
            type="text"
            value={otpCode}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 6);
              setOtpCode(value);
              setError('');
            }}
            placeholder="Enter 6-digit code"
            className="text-center text-lg font-mono tracking-widest usergy-input"
            maxLength={6}
            required
            disabled={loading}
          />
        </div>

        <Button 
          type="submit" 
          className="w-full usergy-btn-primary"
          disabled={loading || otpCode.length !== 6}
        >
          {loading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              <span>Verifying & Setting Up Account...</span>
            </div>
          ) : (
            'Verify Email'
          )}
        </Button>
      </form>

      <div className="text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Didn't receive the code?
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={handleResendCode}
          disabled={resendLoading}
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
    </div>
  );
}
