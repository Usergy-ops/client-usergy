
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Initialize Supabase client with service role
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } }
)

interface SignupRequest {
  action: 'signup'
  email: string
  password: string
  companyName?: string
  firstName?: string
  lastName?: string
  accountType?: string
  sourceUrl?: string
}

interface VerifyOTPRequest {
  action: 'verify-otp'
  email: string
  otpCode: string
  password?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log('Unified auth request:', { action: body.action, email: body.email })

    if (body.action === 'signup') {
      return await handleSignup(body as SignupRequest)
    } else if (body.action === 'verify-otp') {
      return await handleVerifyOTP(body as VerifyOTPRequest)
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Unified auth error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleSignup(request: SignupRequest) {
  const { email, password, companyName, firstName, lastName, accountType, sourceUrl } = request

  try {
    console.log('Processing signup for:', email)

    // Generate OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now

    // Store OTP verification record
    const { error: otpError } = await supabaseAdmin
      .from('auth_otp_verifications')
      .insert({
        email,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
        account_type: accountType || 'client',
        source_url: sourceUrl || '',
        metadata: {
          companyName,
          firstName,
          lastName,
          password_hash: password // We'll hash this properly in verification
        }
      })

    if (otpError) {
      console.error('Error storing OTP:', otpError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to generate verification code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send verification email using Resend
    const emailSent = await sendVerificationEmail(email, otpCode)

    return new Response(
      JSON.stringify({
        success: true,
        emailSent,
        accountType: accountType || 'client',
        message: 'Verification code sent to your email'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Signup error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Signup failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleVerifyOTP(request: VerifyOTPRequest) {
  const { email, otpCode, password } = request

  try {
    console.log('Processing OTP verification for:', email)

    // Retrieve and validate OTP
    const { data: otpRecord, error: otpError } = await supabaseAdmin
      .from('auth_otp_verifications')
      .select('*')
      .eq('email', email)
      .eq('otp_code', otpCode)
      .gt('expires_at', new Date().toISOString())
      .is('verified_at', null)
      .single()

    if (otpError || !otpRecord) {
      console.error('Invalid or expired OTP:', otpError)
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired verification code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create user account
    const userData = {
      email,
      password: password || otpRecord.metadata.password_hash,
      email_confirm: true,
      user_metadata: {
        account_type: otpRecord.account_type,
        source_url: otpRecord.source_url,
        company_name: otpRecord.metadata.companyName,
        first_name: otpRecord.metadata.firstName,
        last_name: otpRecord.metadata.lastName
      }
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser(userData)

    if (authError) {
      console.error('Error creating user:', authError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create user account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Mark OTP as verified
    await supabaseAdmin
      .from('auth_otp_verifications')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', otpRecord.id)

    // Create client record if account type is client
    if (otpRecord.account_type === 'client' && authData.user) {
      await supabaseAdmin
        .from('client_workflow.clients')
        .insert({
          auth_user_id: authData.user.id,
          email: authData.user.email,
          full_name: `${otpRecord.metadata.firstName || ''} ${otpRecord.metadata.lastName || ''}`.trim() || null,
          first_name: otpRecord.metadata.firstName || null,
          last_name: otpRecord.metadata.lastName || null,
          company_name: otpRecord.metadata.companyName || 'My Company'
        })
    }

    // Generate session for the user
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: authData.user.email!
    })

    if (sessionError) {
      console.error('Error generating session:', sessionError)
      return new Response(
        JSON.stringify({ success: false, error: 'Account created but login failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        session: sessionData,
        user: authData.user,
        message: 'Account verified successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('OTP verification error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Verification failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function sendVerificationEmail(email: string, otpCode: string): Promise<boolean> {
  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured')
      return false
    }

    const emailContent = `
      <h2>Welcome to Usergy!</h2>
      <p>Your verification code is:</p>
      <h1 style="font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 4px;">${otpCode}</h1>
      <p>This code will expire in 10 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Usergy <onboarding@usergy.ai>',
        to: [email],
        subject: 'Verify your Usergy account',
        html: emailContent,
      }),
    })

    if (!response.ok) {
      console.error('Email send failed:', await response.text())
      return false
    }

    return true
  } catch (error) {
    console.error('Email send error:', error)
    return false
  }
}
