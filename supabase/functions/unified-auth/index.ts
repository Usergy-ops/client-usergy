// supabase/functions/unified-auth/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const { action, email, password, otp, source_domain } = await req.json()

    switch (action) {
      case 'signup':
        // Check existing user
        const { data: users } = await supabase.auth.admin.listUsers()
        if (users?.users.find(u => u.email === email)) {
          throw new Error('User already exists')
        }

        // Generate OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
        
        // Store OTP with source domain
        await supabase.from('user_otp_verification').insert({
          email,
          otp_code: otpCode,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          metadata: { source_domain }
        })

        // Send email (implement your email logic)
        
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'verify':
        // Verify OTP
        const { data: otpData } = await supabase
          .from('user_otp_verification')
          .select('*')
          .eq('email', email)
          .eq('otp_code', otp)
          .single()

        if (!otpData || new Date() > new Date(otpData.expires_at)) {
          throw new Error('Invalid or expired OTP')
        }

        // Create user with metadata
        const { data: userData, error } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            source_domain: otpData.metadata?.source_domain || source_domain,
            account_type: source_domain?.includes('user.usergy.ai') ? 'user' : 'client'
          }
        })

        if (error) throw error

        // Mark OTP as used
        await supabase
          .from('user_otp_verification')
          .update({ verified_at: new Date().toISOString() })
          .eq('id', otpData.id)

        return new Response(
          JSON.stringify({ success: true, userId: userData.user.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      default:
        throw new Error('Invalid action')
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})