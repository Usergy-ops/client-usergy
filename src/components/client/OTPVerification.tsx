import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Mail, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useOTPVerification } from '@/hooks/useOTPVerification';
import { useErrorLogger } from '@/hooks/useErrorLogger';
import { useNavigate } from 'react-router-dom';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { AuthStatusIndicator } from './AuthStatusIndicator';
import { cn } from '@/lib/utils';

interface OTPVerificationProps {
  email: string;
  password?: string;
  onSuccess: () => void;
  onBack: () => void;
}

export function OTPVerification({ email, password, onSuccess, onBack }: OTPVerificationProps) {
  const [otpCode, setOtpCode] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resendCooldown, setResendCooldown] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { setSession, waitForClientAccount } = useClientAuth();
  const { isVerifying, isResending, error, verifyOTP, resendOTP, reset } = useOTPVerification();
  const { logOTPError } = useErrorLogger();

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otpCode || otpCode.length !== 6 || !password) {
      return;
    }

    setVerificationStatus('verifying');
    reset(); // Clear any previous errors
    
    try {
      console.log('Starting OTP verification process...');
      const result = await verifyOTP(email, otpCode, password);

      if (result.success && result.data?.session) {
        console.log('OTP verification successful, processing session...');
        setVerificationStatus('success');
        
        toast({
          title: "Email verified successfully!",
          description: "Setting up your account...",
        });

        // Set the session in the auth context
        if (result.data.session.session) {
          setSession(result.data.session.session);
        }

        // Wait for client account creation (database trigger should handle this)
        console.log('Waiting for client account creation...');
        const isClient = await waitForClientAccount(result.data.userId, 15);
        
        if (isClient) {
          console.log('Client account confirmed, navigating to dashboard...');
          toast({
            title: "Welcome to Usergy!",
            description: "Your account is ready. Redirecting to dashboard...",
          });
          
          // Small delay for better UX
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 1000);
        } else {
          console.warn('Client account not confirmed, navigating to profile setup...');
          toast({
            title: "Account setup incomplete",
            description: "Please complete your profile setup.",
            variant: "destructive"
          });
          navigate('/profile', { replace: true });
        }
        
        onSuccess();
      } else {
        console.error('OTP verification failed:', result.error);
        setVerificationStatus('error');
        
        await logOTPError(
          new Error(result.error?.message || 'OTP verification failed'),
          'otp_verification_failed',
          email
        );
      }
    } catch (error) {
      console.error('OTP verification exception:', error);
      setVerificationStatus('error');
      await logOTPError(error, 'otp_verification_exception', email);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    
    setResendStatus('sending');
    
    try {
      console.log('Resending OTP code...');
      const result = await resendOTP(email);

      if (result.success) {
        setResendStatus('sent');
        setResendCooldown(60); // 60 second cooldown
        
        toast({
          title: "Code resent!",
          description: "A new verification code has been sent to your email.",
        });
        
        setOtpCode(''); // Clear current code
        reset(); // Clear any errors
        
        // Reset resend status after a delay
        setTimeout(() => {
          setResendStatus('idle');
        }, 3000);
      } else {
        console.error('Failed to resend OTP:', result.error);
        setResendStatus('error');
        
        toast({
          title: "Failed to resend code",
          description: result.error?.message || "Please try again later.",
          variant: "destructive"
        });

        await logOTPError(
          new Error(result.error?.message || 'Failed to resend OTP'),
          'otp_resend_failed',
          email
        );
        
        // Reset error status after delay
        setTimeout(() => {
          setResendStatus('idle');
        }, 3000);
      }
    } catch (error) {
      console.error('Resend OTP exception:', error);
      setResendStatus('error');
      await logOTPError(error, 'otp_resend_exception', email);
    }
  };

  const getResendButtonText = () => {
    if (resendStatus === 'sending') return 'Sending...';
    if (resendStatus === 'sent') return 'Code Sent!';
    if (resendStatus === 'error') return 'Failed - Retry';
    if (resendCooldown > 0) return `Resend in ${resendCooldown}s`;
    return 'Resend Code';
  };

  const getResendButtonIcon = () => {
    if (resendStatus === 'sending') return <RefreshCw className="w-4 h-4 animate-spin" />;
    if (resendStatus === 'sent') return <CheckCircle className="w-4 h-4" />;
    if (resendStatus === 'error') return <AlertCircle className="w-4 h-4" />;
    return <RefreshCw className="w-4 h-4" />;
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

      {/* Status indicator for verification process */}
      {verificationStatus === 'verifying' && (
        <AuthStatusIndicator 
          status="creating" 
          message="Verifying your email address..."
        />
      )}
      
      {verificationStatus === 'success' && (
        <AuthStatusIndicator 
          status="success" 
          message="Email verified! Setting up your account..."
        />
      )}

      {(error || verificationStatus === 'error') && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 animate-in slide-in-from-top-2">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-destructive font-medium">Verification Failed</p>
              <p className="text-sm text-destructive mt-1">
                {error || 'The verification code is invalid or has expired. Please try again.'}
              </p>
            </div>
          </div>
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
              if (error || verificationStatus === 'error') {
                reset();
                setVerificationStatus('idle');
              }
            }}
            placeholder="Enter 6-digit code"
            className="text-center text-lg font-mono tracking-widest usergy-input"
            maxLength={6}
            required
            disabled={verificationStatus === 'verifying' || verificationStatus === 'success'}
          />
          <p className="text-xs text-muted-foreground text-center">
            Enter the 6-digit code sent to your email
          </p>
        </div>

        <Button 
          type="submit" 
          className="w-full usergy-btn-primary"
          disabled={verificationStatus === 'verifying' || verificationStatus === 'success' || otpCode.length !== 6}
        >
          {verificationStatus === 'verifying' ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              <span>Verifying...</span>
            </div>
          ) : verificationStatus === 'success' ? (
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4" />
              <span>Verified!</span>
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
          disabled={resendCooldown > 0 || resendStatus === 'sending'}
          className={cn(
            "w-full",
            resendStatus === 'sent' && "border-green-200 bg-green-50 text-green-700",
            resendStatus === 'error' && "border-red-200 bg-red-50 text-red-700"
          )}
        >
          <div className="flex items-center space-x-2">
            {getResendButtonIcon()}
            <span>{getResendButtonText()}</span>
          </div>
        </Button>
      </div>

      <div className="text-center">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground"
          disabled={verificationStatus === 'verifying' || verificationStatus === 'success'}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Sign Up
        </Button>
      </div>
    </div>
  );
}
