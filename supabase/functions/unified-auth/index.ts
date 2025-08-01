
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const resendApiKey = Deno.env.get('RESEND_API_KEY')

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
  accountType?: 'user' | 'client'
  sourceUrl?: string
}

// Email template functions
function generateOTPEmailHTML(data: {
  email: string
  otpCode: string
  companyName?: string
  firstName?: string
  lastName?: string
  sourceUrl: string
}): string {
  const { email, otpCode, companyName, firstName, lastName, sourceUrl } = data;
  const displayName = firstName && lastName ? `${firstName} ${lastName}` : email;
  const welcomeMessage = companyName ? `Welcome to Usergy! We're excited to have ${companyName} join our platform.` : 'Welcome to Usergy!';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email - Usergy</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 40px 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 40px; }
        .logo { font-size: 28px; font-weight: bold; color: #2563eb; margin-bottom: 10px; }
        .otp-container { background-color: #f8fafc; border: 2px solid #e2e8f0; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0; }
        .otp-code { font-size: 32px; font-weight: bold; color: #1e293b; letter-spacing: 8px; margin: 20px 0; font-family: 'Courier New', monospace; }
        .footer { text-align: center; margin-top: 40px; color: #64748b; font-size: 14px; }
        .warning { background-color: #fef3cd; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">USERGY</div>
            <h1 style="color: #1e293b; margin: 0;">Email Verification</h1>
        </div>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">Hi ${displayName},</p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">${welcomeMessage}</p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">To complete your account setup, please use the verification code below:</p>
        <div class="otp-container">
            <p style="color: #475569; margin: 0; font-size: 14px; margin-bottom: 10px;">Your verification code:</p>
            <div class="otp-code">${otpCode}</div>
            <p style="color: #64748b; margin: 0; font-size: 12px; margin-top: 10px;">This code expires in 10 minutes</p>
        </div>
        <div class="warning">
            <p style="color: #92400e; margin: 0; font-size: 14px;"><strong>Security Notice:</strong> Never share this code with anyone. Usergy will never ask for this code via phone or email.</p>
        </div>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">If you didn't request this verification code, please ignore this email or contact our support team.</p>
        <div class="footer">
            <p>© 2025 Usergy. All rights reserved.</p>
            <p>This email was sent from <a href="${sourceUrl}" style="color: #2563eb;">${sourceUrl}</a></p>
        </div>
    </div>
</body>
</html>
  `;
}

async function sendOTPEmail(email: string, otpCode: string, metadata: any, sourceUrl: string): Promise<boolean> {
  if (!resendApiKey) {
    console.error('RESEND_API_KEY not configured');
    return false;
  }

  try {
    const emailHTML = generateOTPEmailHTML({
      email,
      otpCode,
      companyName: metadata?.company_name,
      firstName: metadata?.first_name,
      lastName: metadata?.last_name,
      sourceUrl
    });

    const emailText = `Hi ${metadata?.first_name && metadata?.last_name ? `${metadata.first_name} ${metadata.last_name}` : email},

Welcome to Usergy! To complete your account setup, please use this verification code: ${otpCode}

This code expires in 10 minutes.

SECURITY NOTICE: Never share this code with anyone.

© 2025 Usergy. All rights reserved.`;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Usergy <noreply@usergy.ai>',
        to: [email],
        subject: 'Verify Your Email - Usergy',
        html: emailHTML,
        text: emailText,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Resend API error:', errorData);
      return false;
    }

    const result = await response.json();
    console.log('Email sent successfully:', result);
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
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
    console.log('Request body received:', JSON.stringify({ ...body, password: body.password ? '[REDACTED]' : undefined }))

    switch (action) {
      case 'signup':
        return await handleSignup(body)
      case 'verify-otp':
        return await handleVerifyOTP(body)
      case 'resend-otp':
        return await handleResendOTP(body)
      default:
        console.error('Invalid action received:', action)
        return new Response(
          JSON.stringify({ error: `Invalid action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('Handler error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleSignup(body: AuthRequest) {
  try {
    const { email, password, companyName, firstName, lastName, accountType, sourceUrl } = body

    console.log(`Signup attempt for: ${email}`)

    // Determine account type - explicit override or domain-based detection
    let detectedAccountType = accountType
    if (!detectedAccountType) {
      const domain = email.split('@')[1]
      detectedAccountType = domain === 'user.usergy.ai' ? 'user' : 'client'
    }
    
    console.log(`Account type determined: ${detectedAccountType} for email: ${email}`)

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
      email_confirm: false, // We'll handle email confirmation with OTP for clients
      user_metadata: {
        companyName: companyName || (detectedAccountType === 'client' ? 'My Company' : ''),
        firstName: firstName || '',
        lastName: lastName || '',
        account_type: detectedAccountType,
        source_url: sourceUrl || 'https://client.usergy.ai'
      }
    })

    if (authError) {
      console.error('Auth creation error:', authError)
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`User created successfully: ${authData.user.id}`)

    // Store account type in account_types table
    const { error: accountTypeError } = await supabaseAdmin
      .from('account_types')
      .insert({
        auth_user_id: authData.user.id,
        account_type: detectedAccountType
      })

    if (accountTypeError) {
      console.error('Account type storage error:', accountTypeError)
      // Continue anyway, this is not critical
    }

    // Handle account type specific flow
    if (detectedAccountType === 'client') {
      // Generate and store OTP for clients
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      const metadata = {
        company_name: companyName,
        first_name: firstName,
        last_name: lastName
      }

      const { error: otpError } = await supabaseAdmin
        .from('auth_otp_verifications')
        .insert({
          email,
          otp_code: otpCode,
          expires_at: expiresAt.toISOString(),
          account_type: 'client',
          source_url: sourceUrl || 'https://client.usergy.ai',
          metadata
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

      // Send OTP email
      const emailSent = await sendOTPEmail(email, otpCode, metadata, sourceUrl || 'https://client.usergy.ai')

      if (!emailSent) {
        console.warn('Email sending failed, but continuing with signup process')
      }

      // Log email attempt
      await supabaseAdmin
        .from('email_send_logs')
        .insert({
          email,
          email_type: 'otp_verification',
          status: emailSent ? 'sent' : 'failed',
          metadata: { otp_code: otpCode, account_type: 'client' }
        })

      console.log(`Client signup successful for: ${email}`)

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Account created. Check your email for verification code.',
          emailSent: emailSent,
          accountType: 'client'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // For users, confirm email immediately
      await supabaseAdmin.auth.admin.updateUserById(authData.user.id, {
        email_confirm: true
      })

      console.log(`User signup successful for: ${email}`)

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Account created successfully.',
          emailSent: false,
          accountType: 'user'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Signup error:', error)
    return new Response(
      JSON.stringify({ error: 'Signup failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleVerifyOTP(body: AuthRequest) {
  try {
    const { email, otpCode, password } = body

    console.log(`OTP verification attempt for: ${email}`)

    // Verify OTP using the consolidated table
    const { data: otpData, error: otpError } = await supabaseAdmin
      .from('auth_otp_verifications')
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
      .from('auth_otp_verifications')
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
          session: sessionData.session,
          user: sessionData.user
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
      JSON.stringify({ error: 'Verification failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleResendOTP(body: AuthRequest) {
  try {
    const { email } = body

    console.log(`OTP resend request for: ${email}`)

    // Get the latest OTP record for metadata
    const { data: latestOtp } = await supabaseAdmin
      .from('auth_otp_verifications')
      .select('metadata, source_url')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Generate new OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Delete old OTP codes for this email
    await supabaseAdmin
      .from('auth_otp_verifications')
      .delete()
      .eq('email', email)
      .is('verified_at', null)

    // Insert new OTP
    const { error: otpError } = await supabaseAdmin
      .from('auth_otp_verifications')
      .insert({
        email,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
        account_type: 'client',
        source_url: latestOtp?.source_url || 'https://client.usergy.ai',
        metadata: latestOtp?.metadata || {}
      })

    if (otpError) {
      console.error('OTP resend error:', otpError)
      return new Response(
        JSON.stringify({ error: 'Failed to generate new verification code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send OTP email
    const emailSent = await sendOTPEmail(
      email, 
      otpCode, 
      latestOtp?.metadata || {}, 
      latestOtp?.source_url || 'https://client.usergy.ai'
    )

    // Log email attempt
    await supabaseAdmin
      .from('email_send_logs')
      .insert({
        email,
        email_type: 'otp_resend',
        status: emailSent ? 'sent' : 'failed',
        metadata: { otp_code: otpCode, resend: true }
      })

    console.log(`OTP resent for: ${email}, email sent: ${emailSent}`)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'New verification code sent',
        emailSent
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('OTP resend error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to resend code', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}
