import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, ArrowLeft, RefreshCw, Mail, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';

interface ImprovedOTPVerificationProps {
  email: string;
  onBack: () => void;
  onSuccess: () => void;
}

export function ImprovedOTPVerification({ email, onBack, onSuccess }: ImprovedOTPVerificationProps) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (otp.length === 6) {
      verifyOTP();
    }
  }, [otp]);

  const verifyOTP = async () => {
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email'
      });

      if (error) {
        throw error;
      }

      setVerified(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (error: any) {
      console.error('OTP verification error:', error);
      setError(error.message || 'Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');

    try {
      const { error } = await supabase.auth.resend({
        type: 'email',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) {
        throw error;
      }

      setResent(true);
      setTimeout(() => setResent(false), 3000);
    } catch (error: any) {
      console.error('Resend error:', error);
      setError(error.message || 'Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <Card className="w-[380px] max-w-full">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Verify Your Email</CardTitle>
        <CardDescription>
          Enter the 6-digit code we sent to <strong className="font-medium">{email}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {verified && (
          <Alert className="bg-success/20 text-success">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Email verified! Redirecting...
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-2">
          <Label htmlFor="otp">Verification Code</Label>
          <InputOTPGroup length={6} value={otp} onChange={setOtp} />
        </div>

        <Button disabled={loading || verified} className="usergy-btn-primary">
          {loading ? (
            <div className="flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Verifying...</span>
            </div>
          ) : (
            'Verify Email'
          )}
        </Button>
      </CardContent>
      <div className="px-6 py-4 flex items-center justify-between">
        <Button type="button" variant="link" onClick={onBack} className="gap-x-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        {resent ? (
          <span className="text-sm text-success font-medium">Code resent!</span>
        ) : (
          <Button
            type="button"
            variant="link"
            disabled={resending}
            onClick={handleResend}
            className="gap-x-2"
          >
            {resending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Resending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                Resend Code
              </>
            )}
          </Button>
        )}
      </div>
    </Card>
  );
}
