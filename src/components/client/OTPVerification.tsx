// src/components/auth/OTPVerification.tsx
// Update to use the new unified-auth endpoint

const verifyOTP = async (code: string) => {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unified-auth`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: 'verify',
        email: pendingSignup.email,
        otp: code,
        password: pendingSignup.password,
      }),
    }
  );
  
  const data = await response.json();
  
  if (response.ok) {
    onSuccess();
  } else {
    setError(data.error || 'Invalid code');
  }
};