// src/components/GoogleAuth.tsx
// Add metadata storage before OAuth redirect

const handleGoogleAuth = async () => {
  // Store account type for post-OAuth processing
  localStorage.setItem('pending_account_type', 'client');
  localStorage.setItem('pending_source_url', window.location.href);
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  
  if (error) {
    console.error('Google auth error:', error);
    localStorage.removeItem('pending_account_type');
    localStorage.removeItem('pending_source_url');
  }
};