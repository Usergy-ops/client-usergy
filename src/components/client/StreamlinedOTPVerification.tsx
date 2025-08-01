
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Mail, RefreshCw, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useOTPVerification } from '@/hooks/useOTPVerification';
import { useErrorLogger } from '@/hooks/useErrorLogger';
import { useNavigate } from 'react-router-dom';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { AuthStatusIndicator } from './AuthStatusIndicator';

interface StreamlinedOTPVerificationProps {
  email: string;
  password?: string;
  onSuccess: () => void;
  onBack: () => void;
}

export function StreamlinedOTPVerification({ email, password, onSuccess, onBack }: StreamlinedOTPVerificationProps) {
  const [otpCode, setOtpCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { verifyOTP } = useClientAuth();
  const { isVerifying, isResending, error, resendOTP, reset } = useOTPVerification();
  const { logOTPError } = useErrorLogger();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otpCode || otpCode.length !== 6) {
      return;
    }

    setIsProcessing(true);
    reset();

    try {
      const result = await verifyOTP(email, otpCode);

      if (result.success) {
        toast({
          title: "Email verified!",
          description: "Welcome to Usergy! Setting up your account...",
        });

        // Simple delay for user feedback
        setTimeout(() => {
          navigate('/client/dashboard', { replace: true });
          onSuccess();
        }, 1000);
      } else {
        await logOTPError(
          new Error(result.error || 'OTP verification failed'),
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
        reset();
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
        <h2 className="text-2xl font-bold text-foreground">Verify Your Email</h2>
        <p className="text-muted-foreground">
          We've sent a 6-digit code to <strong>{email}</strong>
        </p>
      </div>

      {isProcessing && (
        <AuthStatusIndicator 
          status="creating" 
          message="Verifying your email and setting up your account..."
        />
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
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
            className="text-center text-lg font-mono tracking-widest"
            maxLength={6}
            required
            disabled={isProcessing}
          />
        </div>

        <Button 
          type="submit" 
          className="w-full"
          disabled={isProcessing || otpCode.length !== 6}
        >
          {isProcessing ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              <span>Verifying...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4" />
              <span>Verify & Continue</span>
            </div>
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
          disabled={isResending || isProcessing}
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
          disabled={isProcessing}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Sign Up
        </Button>
      </div>
    </div>
  );
}
