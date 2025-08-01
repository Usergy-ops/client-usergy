
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useOTPVerification } from '@/hooks/useOTPVerification';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useSimpleAuthFeedback } from '@/hooks/useSimpleAuthFeedback';

interface SimpleOTPVerificationProps {
  email: string;
  onBack: () => void;
}

export function SimpleOTPVerification({ email, onBack }: SimpleOTPVerificationProps) {
  const navigate = useNavigate();
  const [otp, setOtp] = useState('');
  const { verifyOTP, resendOTP, isVerifying, isResending, error, reset } = useOTPVerification();
  const { showSuccess, showError } = useSimpleAuthFeedback();

  const handleVerify = async () => {
    if (otp.length !== 6) {
      showError('Invalid Code', 'Please enter a valid 6-digit verification code.');
      return;
    }

    reset();
    
    try {
      const result = await verifyOTP(email, otp);
      
      if (result.success) {
        showSuccess('Verification Successful', 'Welcome to Usergy! Redirecting to your dashboard...');
        // Small delay to show success message before redirect
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      } else {
        showError('Verification Failed', result.error?.message || 'Invalid verification code. Please try again.');
        setOtp('');
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      showError('Verification Failed', 'An unexpected error occurred. Please try again.');
      setOtp('');
    }
  };

  const handleResend = async () => {
    reset();
    
    try {
      const result = await resendOTP(email);
      
      if (result.success) {
        showSuccess('Code Sent', 'A new verification code has been sent to your email.');
      } else {
        showError('Resend Failed', result.error?.message || 'Failed to resend verification code. Please try again.');
      }
    } catch (error) {
      console.error('OTP resend error:', error);
      showError('Resend Failed', 'An unexpected error occurred while resending. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        className="p-0 h-auto font-normal text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to sign up
      </Button>

      {/* Email Display */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          We've sent a 6-digit verification code to
        </p>
        <p className="font-semibold text-foreground mt-1">{email}</p>
      </div>

      {/* OTP Input */}
      <div className="flex flex-col items-center space-y-4">
        <InputOTP
          value={otp}
          onChange={setOtp}
          maxLength={6}
          disabled={isVerifying}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}
      </div>

      {/* Verify Button */}
      <Button 
        onClick={handleVerify}
        disabled={otp.length !== 6 || isVerifying}
        className="w-full"
        size="lg"
      >
        {isVerifying ? (
          <>
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            Verifying...
          </>
        ) : (
          'Verify Email'
        )}
      </Button>

      {/* Resend Link */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Didn't receive the code?{' '}
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="text-primary hover:underline font-medium disabled:opacity-50"
          >
            {isResending ? 'Sending...' : 'Resend code'}
          </button>
        </p>
      </div>

      {/* Help Text */}
      <div className="text-center text-xs text-muted-foreground">
        <p>The verification code will expire in 10 minutes.</p>
        <p className="mt-1">Check your spam folder if you don't see the email.</p>
      </div>
    </div>
  );
}
