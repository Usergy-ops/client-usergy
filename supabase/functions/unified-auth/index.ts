// supabase/functions/unified-auth/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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
        
        // Store OTP - FIX: Use correct table name
        await supabase.from('auth_otp_verifications').insert({
          email,
          otp_code: otpCode,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          source_url: source_domain,
          account_type: source_domain?.includes('user.usergy.ai') ? 'user' : 'client',
          metadata: { source_domain }
        })

        // TODO: Send email with your email service
        console.log(`OTP for ${email}: ${otpCode}`)
        
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'verify':
        // Verify OTP - FIX: Use correct table name
        const { data: otpData, error: otpError } = await supabase
          .from('auth_otp_verifications')
          .select('*')
          .eq('email', email)
          .eq('otp_code', otp)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (otpError || !otpData) {
          throw new Error('Invalid or expired OTP')
        }

        // Create user with metadata
        const { data: userData, error: createError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            source_domain: otpData.source_url || source_domain,
            account_type: otpData.account_type
          }
        })

        if (createError) throw createError

        // Mark OTP as used
        await supabase
          .from('auth_otp_verifications')
          .update({ verified_at: new Date().toISOString() })
          .eq('id', otpData.id)

        return new Response(
          JSON.stringify({ success: true, userId: userData.user.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'resend':
        // Implement resend logic
        const { data: lastOtp } = await supabase
          .from('auth_otp_verifications')
          .select('*')
          .eq('email', email)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (lastOtp && new Date(lastOtp.created_at) > new Date(Date.now() - 60000)) {
          throw new Error('Please wait before requesting a new code')
        }

        // Generate new OTP
        const newOtpCode = Math.floor(100000 + Math.random() * 900000).toString()
        
        await supabase.from('auth_otp_verifications').insert({
          email,
          otp_code: newOtpCode,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          source_url: source_domain,
          account_type: source_domain?.includes('user.usergy.ai') ? 'user' : 'client',
          metadata: { source_domain }
        })

        // TODO: Send email
        console.log(`New OTP for ${email}: ${newOtpCode}`)
        
        return new Response(
          JSON.stringify({ success: true }),
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