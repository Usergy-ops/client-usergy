
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Create admin client for service operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Create regular client for auth operations
const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!)

interface AuthRequest {
  action: 'signup' | 'verify-otp' | 'resend-otp'
  email: string
  password?: string
  companyName?: string
  firstName?: string
  lastName?: string
  otpCode?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body: AuthRequest = await req.json()
    const { action } = body

    console.log(`Unified Auth Handler: ${action} action requested`)

    switch (action) {
      case 'signup':
        return await handleSignup(body)
      case 'verify-otp':
        return await handleVerifyOTP(body)
      case 'resend-otp':
        return await handleResendOTP(body)
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('Handler error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleSignup(body: AuthRequest) {
  try {
    const { email, password, companyName, firstName, lastName } = body

    console.log(`Signup attempt for: ${email}`)

    // Determine account type based on domain
    const domain = email.split('@')[1]
    const accountType = domain === 'usergy.ai' ? 'user' : 'client'
    
    console.log(`Account type determined: ${accountType} for domain: ${domain}`)

    // Check if user already exists
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (listError) {
      console.error('Error checking existing users:', listError)
      return new Response(
        JSON.stringify({ error: 'Failed to check existing users' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const existingUser = existingUsers.users.find(user => user.email === email)
    
    if (existingUser) {
      console.log(`User already exists: ${email}`)
      return new Response(
        JSON.stringify({ error: 'User already exists' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create user with metadata
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // We'll handle email confirmation with OTP
      user_metadata: {
        companyName: companyName || (accountType === 'client' ? 'My Company' : ''),
        firstName: firstName || '',
        lastName: lastName || '',
        account_type: accountType
      }
    })

    if (authError) {
      console.error('Auth creation error:', authError)
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate and store OTP for clients only
    if (accountType === 'client') {
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

      const { error: otpError } = await supabaseAdmin
        .from('client_workflow.otp_verifications')
        .insert({
          email,
          otp_code: otpCode,
          expires_at: expiresAt.toISOString()
        })

      if (otpError) {
        console.error('OTP creation error:', otpError)
        // Clean up the user if OTP creation fails
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return new Response(
          JSON.stringify({ error: 'Failed to generate verification code' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Create client record
      const { error: clientError } = await supabaseAdmin
        .from('client_workflow.clients')
        .insert({
          auth_user_id: authData.user.id,
          email: email,
          full_name: firstName && lastName ? `${firstName} ${lastName}` : null,
          company_name: companyName || null
        })

      if (clientError) {
        console.error('Client record creation error:', clientError)
      }

      console.log(`Client signup successful for: ${email}, OTP: ${otpCode}`)

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Account created. Check your email for verification code.',
          emailSent: true,
          debug: { otpCode, accountType } // Remove in production
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // For users, confirm email immediately and create session
      await supabaseAdmin.auth.admin.updateUserById(authData.user.id, {
        email_confirm: true
      })

      console.log(`User signup successful for: ${email}`)

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Account created successfully.',
          emailSent: false,
          debug: { accountType }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Signup error:', error)
    return new Response(
      JSON.stringify({ error: 'Signup failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleVerifyOTP(body: AuthRequest) {
  try {
    const { email, otpCode, password } = body

    console.log(`OTP verification attempt for: ${email}`)

    // Verify OTP
    const { data: otpData, error: otpError } = await supabaseAdmin
      .from('client_workflow.otp_verifications')
      .select('*')
      .eq('email', email)
      .eq('otp_code', otpCode)
      .is('verified_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (otpError || !otpData) {
      console.log(`Invalid or expired OTP for: ${email}`)
      return new Response(
        JSON.stringify({ error: 'Invalid or expired verification code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Mark OTP as verified
    await supabaseAdmin
      .from('client_workflow.otp_verifications')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', otpData.id)

    // Get user and confirm their email
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const userData = existingUsers.users.find(user => user.email === email)
    
    if (userData) {
      // Confirm user email
      await supabaseAdmin.auth.admin.updateUserById(userData.id, {
        email_confirm: true
      })

      // Sign in the user to create a session
      const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: password || ''
      })

      if (signInError) {
        console.error('Sign in after verification error:', signInError)
        return new Response(
          JSON.stringify({ error: 'Verification successful but sign in failed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`OTP verification and sign in successful for: ${email}`)

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Email verified and signed in successfully',
          session: sessionData,
          userId: userData.id
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'User not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('OTP verification error:', error)
    return new Response(
      JSON.stringify({ error: 'Verification failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleResendOTP(body: AuthRequest) {
  try {
    const { email } = body

    console.log(`OTP resend request for: ${email}`)

    // Generate new OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Delete old OTP codes for this email
    await supabaseAdmin
      .from('client_workflow.otp_verifications')
      .delete()
      .eq('email', email)

    // Insert new OTP
    const { error: otpError } = await supabaseAdmin
      .from('client_workflow.otp_verifications')
      .insert({
        email,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString()
      })

    if (otpError) {
      console.error('OTP resend error:', otpError)
      return new Response(
        JSON.stringify({ error: 'Failed to generate new verification code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`OTP resent for: ${email}, new OTP: ${otpCode}`)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'New verification code sent',
        debug: { otpCode } // Remove in production
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('OTP resend error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to resend code' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}
