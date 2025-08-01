import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend@4.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

const resend = new Resend(Deno.env.get('RESEND_API_KEY') ?? '')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, email, password, otp, signup_source, account_type } = await req.json()
    
    // Determine account type from signup source
    const finalAccountType = account_type || (signup_source?.includes('user') ? 'user' : 'client')
    
    console.log(`Unified auth - Action: ${action}, Email: ${email}, Type: ${finalAccountType}`)

    switch (action) {
      case 'generate':
        return await handleGenerateOTP(email, password, finalAccountType)
      case 'verify':
        return await handleVerifyOTP(email, otp, password)
      case 'resend':
        return await handleResendOTP(email)
      default:
        throw new Error('Invalid action')
    }
  } catch (error: any) {
    console.error('Unified auth error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleGenerateOTP(email: string, password: string, accountType: string) {
  // Check if user exists
  const { data: users } = await supabase.auth.admin.listUsers()
  if (users?.users.find(u => u.email === email)) {
    return new Response(
      JSON.stringify({ error: 'User already exists' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Generate OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  // Store OTP in the SINGLE table
  await supabase.from('auth_otp_verifications').insert({
    email,
    otp_code: otpCode,
    source_url: accountType === 'user' ? 'https://user.usergy.ai' : 'https://client.usergy.ai',
    account_type: accountType,
    expires_at: expiresAt,
    metadata: { password } // Store hashed in production
  })

  // Send OTP email
  await resend.emails.send({
    from: 'Usergy <no-reply@usergy.ai>',
    to: email,
    subject: 'Your Verification Code',
    html: `Your code is: <strong>${otpCode}</strong>`
  })

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleVerifyOTP(email: string, otp: string, password: string) {
  // Get OTP record
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

  // Create user with proper metadata
  const { data: userData, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      account_type: otpData.account_type,
      source_url: otpData.source_url
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

async function handleResendOTP(email: string) {
  // Implementation similar to generate but for existing users
  // ... (implement based on your needs)
}
