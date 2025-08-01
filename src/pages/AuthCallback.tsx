
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleCallback = async () => {
      // Get stored account type
      const accountType = localStorage.getItem('pending_account_type') || 'client'
      const sourceUrl = localStorage.getItem('pending_source_url') || window.location.origin
      
      // Update user metadata with account type
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user && !user.user_metadata.account_type) {
        await supabase.auth.updateUser({
          data: {
            account_type: accountType,
            source_url: sourceUrl
          }
        })
      }
      
      // Clean up
      localStorage.removeItem('pending_account_type')
      localStorage.removeItem('pending_source_url')
      
      // Redirect based on account type
      if (accountType === 'user') {
        navigate('/dashboard')
      } else {
        navigate('/client/dashboard')
      }
    }

    handleCallback()
  }, [navigate])

  return <div>Processing authentication...</div>
}

export { AuthCallback }
