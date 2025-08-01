// src/contexts/AuthContext.tsx (User Project)
// src/contexts/ClientAuthContext.tsx (Client Project)

const signUp = async (email: string, password: string) => {
  try {
    const sourceUrl = window.location.href
    
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unified-auth`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          action: 'signup',
          email,
          password,
          sourceUrl
        })
      }
    )

    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
    
    return { error: null }
  } catch (error) {
    return { error: error.message }
  }
}