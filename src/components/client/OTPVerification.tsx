// In src/components/client/OTPVerification.tsx
// Update the handleVerify function:

const handleVerify = async (otpCode: string) => {
  setLoading(true);
  setError('');
  
  try {
    console.log('Verifying OTP for:', email);
    
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: 'email',
    });

    if (error) {
      console.error('OTP verification error:', error);
      setError('Invalid verification code. Please try again.');
      setLoading(false);
      return;
    }

    console.log('OTP verification successful');
    onSuccess();
    
    // The auth state change in context will handle redirect
    
  } catch (error) {
    console.error('OTP verification exception:', error);
    setError('An error occurred. Please try again.');
    setLoading(false);
  }
};