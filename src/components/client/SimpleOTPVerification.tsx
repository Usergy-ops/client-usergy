
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Mail, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { supabase } from '@/lib/supabase';

interface SimpleOTPVerificationProps {
  email: string;
  onBack: () => void;
}

export function SimpleOTPVerification({ email, onBack }: SimpleOTPVerificationProps) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const navigate = useNavigate();
  const { verifyOTP } = useClientAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on input
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otp.length !== 6) return;

    setLoading(true);
    setError('');

    const result = await verifyOTP(email, otp);
    
    if (result.success) {
      navigate('/client/profile');
    } else {
      setError(result.error || 'Invalid verification code');
    }
    
    setLoading(false);
  };

  const handleResendOTP = async () => {
    setResendLoading(true);
    
    try {
      // Call the resend endpoint
      const { error } = await supabase.functions.invoke('client-auth-handler/resend-otp', {
        body: { email }
      });
      
      if (!error) {
        setOtp('');
        setError('');
      }
    } catch (error) {
      console.error('Resend error:', error);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="otp" className="text-sm font-medium">Verification Code</Label>
          <Input
            ref={inputRef}
            id="otp"
            type="text"
            value={otp}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 6);
              setOtp(value);
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
          disabled={loading || otp.length !== 6}
        >
          {loading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              <span>Verifying...</span>
            </div>
          ) : (
            'Verify'
          )}
        </Button>
      </form>

      <div className="text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Didn't receive the code?
        </p>
        
        <Button
          type="button"
          variant="link"
          onClick={handleResendOTP}
          disabled={resendLoading}
          className="text-primary hover:underline"
        >
          {resendLoading ? 'Sending...' : 'Resend OTP'}
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
