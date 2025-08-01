
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get stored account type
        const accountType = localStorage.getItem('pending_account_type') || 'client'
        const sourceUrl = localStorage.getItem('pending_source_url') || window.location.origin
        
        console.log('AuthCallback: Processing auth callback with account type:', accountType)
        
        // Update user metadata with account type
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError) {
          console.error('AuthCallback: Error getting user:', userError)
          navigate('/')
          return
        }
        
        if (user && !user.user_metadata.account_type) {
          console.log('AuthCallback: Updating user metadata for user:', user.id)
          
          const { error: updateError } = await supabase.auth.updateUser({
            data: {
              account_type: accountType,
              source_url: sourceUrl
            }
          })
          
          if (updateError) {
            console.error('AuthCallback: Error updating user metadata:', updateError)
          }
          
          // Store account type in account_types table for consistency
          const { error: accountTypeError } = await supabase
            .from('account_types')
            .upsert({
              auth_user_id: user.id,
              account_type: accountType
            })
            
          if (accountTypeError) {
            console.error('AuthCallback: Error storing account type:', accountTypeError)
          }
        }
        
        // Clean up localStorage
        localStorage.removeItem('pending_account_type')
        localStorage.removeItem('pending_source_url')
        
        // Always redirect to profile page for both account types
        console.log('AuthCallback: Redirecting to profile page')
        navigate('/profile')
        
      } catch (error) {
        console.error('AuthCallback: Exception during callback handling:', error)
        navigate('/')
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="glass-card p-8 text-center">
        <div className="flex items-center justify-center space-x-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <div>
            <span className="text-lg font-semibold">Processing authentication...</span>
            <p className="text-sm text-muted-foreground mt-1">Please wait while we complete your sign in</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export { AuthCallback }
