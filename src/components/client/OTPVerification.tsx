
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Mail, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useOTPVerification } from '@/hooks/useOTPVerification';
import { useErrorLogger } from '@/hooks/useErrorLogger';

interface OTPVerificationProps {
  email: string;
  onSuccess: () => void;
  onBack: () => void;
}

export function OTPVerification({ email, onSuccess, onBack }: OTPVerificationProps) {
  const [otpCode, setOtpCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { isVerifying, isResending, error, verifyOTP, resendOTP, reset } = useOTPVerification();
  const { logOTPError } = useErrorLogger();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otpCode || otpCode.length !== 6) {
      return;
    }

    setIsProcessing(true);
    try {
      const result = await verifyOTP(email, otpCode);

      if (result.success) {
        toast({
          title: "Email verified successfully!",
          description: "Redirecting to complete setup...",
        });

        onSuccess();
        
        // Redirect to auth callback instead of navigating directly to dashboard
        window.location.href = '/auth/callback';
      } else {
        await logOTPError(
          new Error(result.error?.message || 'OTP verification failed'),
          'otp_verification_failed',
          email
        );
      }
    } catch (error) {
      await logOTPError(error, 'otp_verification_exception', email);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResendCode = async () => {
    try {
      const result = await resendOTP(email);

      if (result.success) {
        toast({
          title: "Code resent!",
          description: "A new verification code has been sent to your email.",
        });
        setOtpCode('');
      } else {
        await logOTPError(
          new Error(result.error?.message || 'Failed to resend OTP'),
          'otp_resend_failed',
          email
        );
      }
    } catch (error) {
      await logOTPError(error, 'otp_resend_exception', email);
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
              if (error) reset();
            }}
            placeholder="Enter 6-digit code"
            className="text-center text-lg font-mono tracking-widest usergy-input"
            maxLength={6}
            required
            disabled={isVerifying || isProcessing}
          />
        </div>

        <Button 
          type="submit" 
          className="w-full usergy-btn-primary"
          disabled={isVerifying || isProcessing || otpCode.length !== 6}
        >
          {isVerifying || isProcessing ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              <span>Verifying...</span>
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
          disabled={isResending}
          className="w-full"
        >
          {isResending ? (
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
          disabled={isVerifying || isProcessing}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Sign Up
        </Button>
      </div>
    </div>
  );
}
