// src/components/GoogleAuth.tsx (Both Projects)

const handleGoogleAuth = async () => {
  const sourceUrl = window.location.href
  const accountType = sourceUrl.includes('user.usergy.ai') ? 'user' : 'client'
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent'
      },
      // Store account type in localStorage before redirect
      scopes: 'email profile'
    }
  })
  
  if (!error) {
    // Store account type for post-OAuth processing
    localStorage.setItem('pending_account_type', accountType)
    localStorage.setItem('pending_source_url', sourceUrl)
  }
}