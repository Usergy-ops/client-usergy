
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Mail, RefreshCw, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface ConsolidatedOTPVerificationProps {
  email: string;
  password?: string;
  onSuccess: () => void;
  onBack: () => void;
}

type VerificationStep = 'input' | 'verifying' | 'creating-session' | 'setting-up-account' | 'complete' | 'error';

export function ConsolidatedOTPVerification({ email, password, onSuccess, onBack }: ConsolidatedOTPVerificationProps) {
  const [otpCode, setOtpCode] = useState('');
  const [currentStep, setCurrentStep] = useState<VerificationStep>('input');
  const [error, setError] = useState<string>('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { setSession, waitForClientAccount } = useClientAuth();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const navigationRef = useRef(false); // Prevent double navigation

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Handle resend cooldown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const clearError = () => {
    setError('');
    if (currentStep === 'error') {
      setCurrentStep('input');
    }
  };

  const safeNavigate = (path: string, delay = 0) => {
    if (navigationRef.current) {
      console.log('Navigation already in progress, skipping duplicate navigation');
      return;
    }
    
    navigationRef.current = true;
    console.log(`Navigating to ${path} after ${delay}ms delay`);
    
    if (delay > 0) {
      timeoutRef.current = setTimeout(() => {
        navigate(path, { replace: true });
        onSuccess();
      }, delay);
    } else {
      navigate(path, { replace: true });
      onSuccess();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!otpCode || otpCode.length !== 6 || !password) {
      setError('Please enter a valid 6-digit code.');
      return;
    }

    setCurrentStep('verifying');
    setError('');
    navigationRef.current = false; // Reset navigation flag

    try {
      console.log('=== Starting OTP Verification Process ===');
      console.log('Email:', email);
      console.log('OTP Code:', otpCode);
      
      const { data, error: verifyError } = await supabase.functions.invoke('client-auth-handler/verify-otp', {
        body: { email, otpCode, password }
      });

      if (verifyError) {
        console.error('OTP verification error:', verifyError);
        setCurrentStep('error');
        setError('Verification failed. Please check your code and try again.');
        return;
      }

      if (!data?.success) {
        console.error('OTP verification failed:', data?.error);
        setCurrentStep('error');
        setError(data?.error || 'Invalid verification code. Please try again.');
        return;
      }

      console.log('✅ OTP verified successfully');
      setCurrentStep('creating-session');

      // Set the session with proper error handling
      if (data.session?.session) {
        console.log('Setting session in auth context...');
        setSession(data.session.session);
        
        // Small delay to ensure session is set
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setCurrentStep('setting-up-account');
        
        console.log('Waiting for client account setup...');
        const isClient = await waitForClientAccount(data.userId, 15); // Increased timeout
        
        if (isClient) {
          console.log('✅ Client account confirmed, completing setup...');
          setCurrentStep('complete');
          
          toast({
            title: "Welcome to Usergy!",
            description: "Your account has been created successfully.",
          });

          // Navigate with a delay for better UX
          safeNavigate('/dashboard', 2000);
        } else {
          console.warn('❌ Client account setup incomplete');
          
          toast({
            title: "Account setup needed",
            description: "Let's complete your profile setup.",
          });
          
          safeNavigate('/profile', 1000);
        }
      } else {
        console.error('No session data received');
        setCurrentStep('error');
        setError('Failed to create session. Please try again.');
      }

    } catch (error) {
      console.error('OTP verification exception:', error);
      setCurrentStep('error');
      setError('An unexpected error occurred. Please try again.');
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || isResending) return;
    
    setIsResending(true);
    setError('');

    try {
      console.log('Resending OTP code...');
      const { data, error: resendError } = await supabase.functions.invoke('client-auth-handler/resend-otp', {
        body: { email }
      });

      if (resendError || !data?.success) {
        console.error('Failed to resend OTP:', resendError || data?.error);
        toast({
          title: "Resend failed",
          description: data?.error || "Please try again later.",
          variant: "destructive"
        });
        return;
      }

      setResendCooldown(60);
      setOtpCode('');
      clearError();
      
      toast({
        title: "Code resent!",
        description: "A new verification code has been sent to your email.",
      });

    } catch (error) {
      console.error('Resend OTP exception:', error);
      toast({
        title: "Resend failed",
        description: "Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsResending(false);
    }
  };

  const getStepMessage = () => {
    switch (currentStep) {
      case 'verifying':
        return 'Verifying your code...';
      case 'creating-session':
        return 'Creating your session...';
      case 'setting-up-account':
        return 'Setting up your account...';
      case 'complete':
        return 'Setup complete! Redirecting...';
      default:
        return null;
    }
  };

  const isProcessing = currentStep !== 'input' && currentStep !== 'error';
  const stepMessage = getStepMessage();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
          currentStep === 'complete' ? 'bg-green-100' : 'bg-primary/10'
        )}>
          {currentStep === 'complete' ? (
            <CheckCircle className="w-8 h-8 text-green-600" />
          ) : (
            <Mail className="w-8 h-8 text-primary" />
          )}
        </div>
        
        <h2 className="text-2xl font-bold text-foreground">
          {currentStep === 'complete' ? 'Welcome to Usergy!' : 'Check Your Email'}
        </h2>
        
        <p className="text-muted-foreground">
          {currentStep === 'complete' 
            ? 'Your account has been created successfully!'
            : `We've sent a 6-digit verification code to ${email}`
          }
        </p>
      </div>

      {/* Progress indicator */}
      {isProcessing && stepMessage && (
        <div className="bg-muted/50 rounded-lg p-4 flex items-center space-x-3">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">{stepMessage}</p>
        </div>
      )}

      {/* Error display */}
      {error && currentStep === 'error' && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-destructive font-medium">Verification Failed</p>
              <p className="text-sm text-destructive mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* OTP Form - only show during input or error states */}
      {(currentStep === 'input' || currentStep === 'error') && (
        <>
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
                  clearError();
                }}
                placeholder="Enter 6-digit code"
                className="text-center text-lg font-mono tracking-widest usergy-input"
                maxLength={6}
                required
                disabled={isProcessing}
                autoComplete="one-time-code"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full usergy-btn-primary"
              disabled={isProcessing || otpCode.length !== 6}
            >
              {isProcessing ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (
                'Verify & Create Account'
              )}
            </Button>
          </form>

          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Didn't receive the code?
            </p>
            
            <Button
              type="button"
              variant="outline"
              onClick={handleResendCode}
              disabled={resendCooldown > 0 || isResending || isProcessing}
              className="w-full"
            >
              <div className="flex items-center space-x-2">
                <RefreshCw className={cn("w-4 h-4", isResending && "animate-spin")} />
                <span>
                  {isResending ? 'Sending...' :
                   resendCooldown > 0 ? `Resend in ${resendCooldown}s` :
                   'Resend Code'}
                </span>
              </div>
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
        </>
      )}

      {/* Processing states - show helpful tips */}
      {isProcessing && currentStep !== 'complete' && (
        <div className="bg-muted/30 rounded-lg p-4 text-center space-y-2">
          <p className="text-sm font-medium text-foreground">
            Please wait while we set up your account
          </p>
          <p className="text-xs text-muted-foreground">
            This usually takes less than 30 seconds. Please don't close this window.
          </p>
        </div>
      )}
    </div>
  );
}
