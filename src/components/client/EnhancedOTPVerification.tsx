
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Mail, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useOTPVerification } from '@/hooks/useOTPVerification';
import { useErrorLogger } from '@/hooks/useErrorLogger';
import { useNavigate } from 'react-router-dom';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { AuthStatusIndicator } from './AuthStatusIndicator';
import { AuthProgressSteps } from './AuthProgressSteps';

interface EnhancedOTPVerificationProps {
  email: string;
  password?: string;
  onSuccess: () => void;
  onBack: () => void;
}

export function EnhancedOTPVerification({ email, password, onSuccess, onBack }: EnhancedOTPVerificationProps) {
  const [otpCode, setOtpCode] = useState('');
  const [authStep, setAuthStep] = useState<'verification' | 'account-creation' | 'workspace-setup' | 'complete'>('verification');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const { toast } = useToast();
  const navigate = useNavigate();
  const { verifyOTP } = useClientAuth();
  const { isVerifying, isResending, error, resendOTP, reset } = useOTPVerification();
  const { logOTPError } = useErrorLogger();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otpCode || otpCode.length !== 6 || !password) {
      return;
    }

    try {
      setAuthStep('verification');
      setStatusMessage('Verifying your email...');

      const result = await verifyOTP(email, otpCode);

      if (result.success) {
        setAuthStep('account-creation');
        setStatusMessage('Email verified! Creating your account...');
        
        // Wait a moment for the database trigger to process
        await new Promise(resolve => setTimeout(resolve, 2000));

        setAuthStep('workspace-setup');
        setStatusMessage('Setting up your workspace...');

        // Wait a bit more for client account creation
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        setAuthStep('complete');
        setStatusMessage('Account setup complete! Redirecting...');
        
        toast({
          title: "Welcome to Usergy!",
          description: "Your account has been created successfully.",
        });

        await new Promise(resolve => setTimeout(resolve, 1500));
        navigate('/dashboard', { replace: true });
        
      } else {
        await logOTPError(
          new Error(result.error || 'OTP verification failed'),
          'otp_verification_failed',
          email
        );
        
        setAuthStep('verification');
        setStatusMessage('');
      }
    } catch (error) {
      await logOTPError(error, 'otp_verification_exception', email);
      setAuthStep('verification');
      setStatusMessage('');
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

  const isProcessing = isVerifying || authStep !== 'verification';

  return (
    <div className="space-y-8">
      {/* Progress Steps */}
      <div className="text-center">
        <AuthProgressSteps currentStep={authStep} className="mb-6" />
        
        {authStep === 'verification' && (
          <>
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Check Your Email</h2>
            <p className="text-muted-foreground mt-2">
              We've sent a 6-digit verification code to <strong>{email}</strong>
            </p>
          </>
        )}

        {authStep !== 'verification' && (
          <>
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Setting Up Your Account</h2>
            <p className="text-muted-foreground mt-2">
              Please wait while we prepare your Usergy workspace
            </p>
          </>
        )}
      </div>

      {/* Status Indicator */}
      {(isProcessing || statusMessage) && (
        <AuthStatusIndicator 
          status={authStep === 'verification' ? 'checking' : authStep === 'complete' ? 'success' : 'creating'}
          message={statusMessage}
        />
      )}

      {/* Error Display */}
      {error && authStep === 'verification' && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 animate-in slide-in-from-top-2">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <p className="text-sm text-destructive font-medium">Verification Failed</p>
          </div>
          <p className="text-sm text-destructive mt-1">{error}</p>
        </div>
      )}

      {/* OTP Form - Only show during verification step */}
      {authStep === 'verification' && (
        <form onSubmit={handleVerify} className="space-y-6">
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
              disabled={isProcessing}
            />
          </div>

          <Button 
            type="submit" 
            className="w-full usergy-btn-primary"
            disabled={isProcessing || otpCode.length !== 6}
          >
            {isVerifying ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                <span>Verifying...</span>
              </div>
            ) : (
              'Verify & Create Account'
            )}
          </Button>

          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Didn't receive the code?
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={handleResendCode}
              disabled={isResending || isProcessing}
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
              disabled={isProcessing}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sign Up
            </Button>
          </div>
        </form>
      )}

      {/* Tips for users during processing */}
      {isProcessing && authStep !== 'verification' && (
        <div className="bg-muted/30 rounded-lg p-4 text-center space-y-2">
          <p className="text-sm font-medium text-foreground">
            Setting up your account...
          </p>
          <p className="text-xs text-muted-foreground">
            Please don't close this window. This process usually takes less than 30 seconds.
          </p>
        </div>
      )}
    </div>
  );
}
