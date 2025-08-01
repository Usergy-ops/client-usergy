// src/contexts/ClientAuthContext.tsx
// Update the signUp function to use the new unified-auth endpoint

// Add at the top of the file
interface UnifiedAuthResponse {
  success?: boolean;
  error?: string;
  user?: any;
  redirectTo?: string;
}

// Update the signUp function
const signUp = async (email: string, password: string): Promise<{ error: string | null }> => {
  try {
    const sourceUrl = window.location.origin;
    
    const { data, error } = await supabase.functions.invoke<UnifiedAuthResponse>('unified-auth', {
      body: {
        action: 'generate',
        email,
        password,
        source_url: sourceUrl
      }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    
    return { error: null };
  } catch (error: any) {
    console.error('Signup error:', error);
    return { error: error.message || 'Signup failed' };
  }
};

const signUp = async (email: string, password: string): Promise<{ error: string | null }> => {
  try {
    const sourceUrl = window.location.href;
    
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unified-auth`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: 'signup',
          email,
          password,
          sourceUrl,
        }),
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Signup failed');
    }
    
    return { error: null };
  } catch (error) {
    console.error('Signup error:', error);
    return { error: error.message };
  }
};