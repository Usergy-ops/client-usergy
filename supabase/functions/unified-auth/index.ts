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

  try {
    const { action, email, password, otp, sourceUrl } = await req.json()
    
    // Determine account type from source URL
    const accountType = sourceUrl.includes('user.usergy.ai') ? 'user' : 'client'
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    switch (action) {
      case 'signup':
        return await handleSignup(supabase, email, password, accountType, sourceUrl)
      case 'verify':
        return await handleVerifyOTP(supabase, email, otp, password)
      case 'resend':
        return await handleResendOTP(supabase, email)
      default:
        throw new Error('Invalid action')
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleSignup(supabase, email, password, accountType, sourceUrl) {
  // Check if user exists
  const { data: existingUser } = await supabase.auth.admin.getUserByEmail(email)
  if (existingUser) {
    return new Response(
      JSON.stringify({ error: 'User already exists' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Generate OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  // Store OTP with account type
  await supabase.from('auth_otp_verifications').insert({
    email,
    otp_code: otpCode,
    source_url: sourceUrl,
    account_type: accountType,
    expires_at: expiresAt,
    metadata: { password } // Store encrypted in production
  })

  // Send OTP email (implement with Resend)
  await sendOTPEmail(email, otpCode, accountType)

  return new Response(
    JSON.stringify({ success: true, message: 'Verification code sent' }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleVerifyOTP(supabase, email, otp, password) {
  // Verify OTP
  const { data: otpData } = await supabase
    .from('auth_otp_verifications')
    .select('*')
    .eq('email', email)
    .eq('otp_code', otp)
    .is('verified_at', null)
    .single()

  if (!otpData || new Date() > new Date(otpData.expires_at)) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired code' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Create user with metadata
  const { data: userData, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      account_type: otpData.account_type,
      source_url: otpData.source_url,
      signup_source: `${otpData.account_type}_signup`
    }
  })

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Mark OTP as verified
  await supabase
    .from('auth_otp_verifications')
    .update({ verified_at: new Date() })
    .eq('id', otpData.id)

  return new Response(
    JSON.stringify({ success: true, user: userData.user }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}