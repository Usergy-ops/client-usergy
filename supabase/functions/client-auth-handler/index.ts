import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const resend = new Resend(resendApiKey);

interface ClientSignupRequest {
  email: string;
  password: string;
  companyName: string;
  firstName: string;
  lastName: string;
}

interface ClientOTPVerificationRequest {
  email: string;
  otpCode: string;
}

interface ClientResendOTPRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    switch (path) {
      case 'signup':
        return await handleClientSignup(req);
      case 'verify-otp':
        return await handleOTPVerification(req);
      case 'resend-otp':
        return await handleResendOTP(req);
      default:
        return new Response(JSON.stringify({ error: 'Invalid endpoint' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }
  } catch (error: any) {
    console.error('Error in client-auth-handler:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

async function handleClientSignup(req: Request): Promise<Response> {
  const { email, password, companyName, firstName, lastName }: ClientSignupRequest = await req.json();

  // Check if user already exists
  const { data: existingUser } = await supabase.auth.admin.listUsers();
  const userExists = existingUser.users.some(user => user.email === email);
  
  if (userExists) {
    return new Response(
      JSON.stringify({ error: 'User with this email already exists' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // Create user with client metadata
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: false, // We'll handle email confirmation manually
    user_metadata: {
      account_type: 'client',
      company_name: companyName,
      first_name: firstName,
      last_name: lastName,
    }
  });

  if (authError) {
    console.error('Auth error:', authError);
    return new Response(
      JSON.stringify({ error: authError.message }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // Generate and store OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const { error: otpError } = await supabase
    .from('user_otp_verification')
    .insert({
      email,
      otp_code: otpCode,
      expires_at: expiresAt.toISOString(),
    });

  if (otpError) {
    console.error('OTP storage error:', otpError);
  }

// Send OTP email with improved error handling
  try {
    const emailResult = await resend.emails.send({
      from: 'Usergy Client Portal <client@user.usergy.ai>',
      to: [email],
      subject: 'Welcome to Usergy - Verify Your Email',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Usergy</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            
            <!-- Header with Logo -->
            <div style="background: linear-gradient(135deg, #00C6FB 0%, #005BEA 100%); padding: 40px 20px; text-align: center;">
              <div style="margin: 0 auto 20px; text-align: center;">
                <svg width="160" height="50" viewBox="0 0 320 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="usergy-gradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                      <stop stop-color="#ffffff"/>
                      <stop offset="1" stop-color="#f8fafc"/>
                    </linearGradient>
                    <linearGradient id="text-gradient" x1="60" y1="40" x2="320" y2="40" gradientUnits="userSpaceOnUse">
                      <stop stop-color="#ffffff"/>
                      <stop offset="1" stop-color="#f8fafc"/>
                    </linearGradient>
                  </defs>
                  <rect x="0" y="20" width="40" height="40" rx="10" fill="url(#usergy-gradient)"/>
                  <g transform="translate(8,28)">
                    <circle cx="6" cy="12" r="3" fill="#00C6FB"/>
                    <circle cx="18" cy="6" r="3" fill="#00C6FB"/>
                    <circle cx="18" cy="18" r="3" fill="#00C6FB"/>
                    <path d="M8.5 14l7-4" stroke="#00C6FB" stroke-width="2"/>
                    <path d="M8.5 10l7 4" stroke="#00C6FB" stroke-width="2"/>
                  </g>
                  <text x="60" y="54" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="44" font-weight="bold" fill="url(#text-gradient)">
                    Usergy
                  </text>
                </svg>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Welcome to Usergy</h1>
              <p style="color: #e2e8f0; margin: 10px 0 0; font-size: 16px;">Client Portal</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1a202c; margin: 0 0 20px; font-size: 24px; font-weight: 600;">Email Verification Required</h2>
              
              <p style="color: #4a5568; margin: 0 0 20px; font-size: 16px; line-height: 1.6;">
                Hi <strong>${firstName}</strong>,
              </p>
              
              <p style="color: #4a5568; margin: 0 0 30px; font-size: 16px; line-height: 1.6;">
                Thank you for signing up for the Usergy Client Portal. To complete your registration and access your dashboard, please verify your email address using the verification code below:
              </p>
              
              <!-- OTP Code Box -->
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
                <p style="color: #ffffff; margin: 0 0 10px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 500;">Verification Code</p>
                <div style="background-color: #ffffff; border-radius: 8px; padding: 20px; margin: 10px 0;">
                  <span style="color: #1a202c; font-size: 36px; font-weight: 700; letter-spacing: 6px; font-family: 'Courier New', monospace;">${otpCode}</span>
                </div>
                <p style="color: #e2e8f0; margin: 10px 0 0; font-size: 14px;">Expires in 10 minutes</p>
              </div>
              
              <div style="background-color: #f7fafc; border-left: 4px solid #667eea; padding: 16px; margin: 30px 0;">
                <p style="color: #4a5568; margin: 0; font-size: 14px; line-height: 1.5;">
                  <strong>Security Note:</strong> If you didn't sign up for a Usergy account, you can safely ignore this email. Your email address will not be used for any purpose.
                </p>
              </div>
              
              <p style="color: #4a5568; margin: 30px 0 0; font-size: 16px; line-height: 1.6;">
                Once verified, you'll have full access to your Usergy Client Portal dashboard and all available features.
              </p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f7fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #718096; margin: 0 0 10px; font-size: 14px;">
                Best regards,<br>
                <strong>The Usergy Team</strong>
              </p>
              <div style="margin: 20px 0;">
                <a href="https://usergy.ai" style="color: #667eea; text-decoration: none; font-size: 14px; margin: 0 10px;">Website</a>
                <span style="color: #cbd5e0;">|</span>
                <a href="mailto:support@usergy.ai" style="color: #667eea; text-decoration: none; font-size: 14px; margin: 0 10px;">Support</a>
              </div>
              <p style="color: #a0aec0; margin: 0; font-size: 12px;">
                © 2024 Usergy Technologies. All rights reserved.
              </p>
            </div>
            
          </div>
        </body>
        </html>
      `
    });

    console.log('Email sent successfully:', emailResult);
    
    // Log successful email delivery
    await supabase.from('error_logs').insert({
      error_type: 'info',
      error_message: 'OTP email sent successfully',
      context: 'client_signup_email',
      user_id: authData.user.id,
      metadata: {
        email,
        email_id: emailResult.data?.id,
        company_name: companyName
      }
    });

  } catch (emailError) {
    console.error('Email sending error:', emailError);
    
    // Log email delivery failure
    await supabase.from('error_logs').insert({
      error_type: 'email_delivery_error',
      error_message: emailError.message,
      context: 'client_signup_email',
      user_id: authData.user.id,
      metadata: {
        email,
        company_name: companyName,
        error_detail: emailError
      }
    });
    
    // Don't fail the signup if email fails, but inform the user
    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: authData.user.id,
        warning: 'Account created but email delivery failed. Please contact support for verification assistance.' 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: 'User created successfully. Please check your email for verification code.',
      userId: authData.user.id 
    }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}

async function handleOTPVerification(req: Request): Promise<Response> {
  const { email, otpCode }: ClientOTPVerificationRequest = await req.json();

  // Verify OTP
  const { data: otpData, error: otpError } = await supabase
    .from('user_otp_verification')
    .select('*')
    .eq('email', email)
    .eq('otp_code', otpCode)
    .gt('expires_at', new Date().toISOString())
    .is('verified_at', null)
    .single();

  if (otpError || !otpData) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired verification code' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // Mark OTP as verified
  await supabase
    .from('user_otp_verification')
    .update({ verified_at: new Date().toISOString() })
    .eq('id', otpData.id);

  // Confirm the user's email and get user data
  const { data: userData } = await supabase.auth.admin.listUsers();
  const user = userData.users.find(u => u.email === email);
  
  if (user) {
    // Confirm email
    await supabase.auth.admin.updateUserById(user.id, {
      email_confirm: true
    });

    // Create client account after email verification
    try {
      const userMetadata = user.user_metadata;
      const { error: createError } = await supabase.rpc(
        'create_client_account_for_user',
        {
          user_id_param: user.id,
          company_name_param: userMetadata?.company_name || 'My Company',
          first_name_param: userMetadata?.first_name || null,
          last_name_param: userMetadata?.last_name || null
        }
      );
      
      if (createError) {
        console.error('Error creating client account:', createError);
      }
    } catch (accountError) {
      console.error('Error in client account creation:', accountError);
    }

    // Generate tokens for automatic sign-in
    const { data: tokenData, error: tokenError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: `${Deno.env.get('SITE_URL') || 'https://client.usergy.ai'}/auth/callback`
      }
    });

    if (!tokenError && tokenData.properties?.action_link) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email verified successfully! Redirecting...',
          redirectTo: '/dashboard',
          autoSignInUrl: tokenData.properties.action_link
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: 'Email verified successfully! Please sign in to continue.',
      redirectTo: '/?signin=true'
    }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}

async function handleResendOTP(req: Request): Promise<Response> {
  const { email }: ClientResendOTPRequest = await req.json();

  // Generate new OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store new OTP (invalidate old ones)
  await supabase
    .from('user_otp_verification')
    .update({ verified_at: new Date().toISOString() })
    .eq('email', email)
    .is('verified_at', null);

  const { error: otpError } = await supabase
    .from('user_otp_verification')
    .insert({
      email,
      otp_code: otpCode,
      expires_at: expiresAt.toISOString(),
    });

  if (otpError) {
    console.error('OTP storage error:', otpError);
    return new Response(
      JSON.stringify({ error: 'Failed to generate verification code' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // Get user name for email
  const { data: userData } = await supabase.auth.admin.listUsers();
  const user = userData.users.find(u => u.email === email);
  const firstName = user?.user_metadata?.first_name || 'there';

  // Send new OTP email with improved error handling
  try {
    const emailResult = await resend.emails.send({
      from: 'Usergy Client Portal <client@user.usergy.ai>',
      to: [email],
      subject: 'New Verification Code - Usergy Client Portal',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Verification Code</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            
            <!-- Header with Logo -->
            <div style="background: linear-gradient(135deg, #00C6FB 0%, #005BEA 100%); padding: 40px 20px; text-align: center;">
              <div style="margin: 0 auto 20px; text-align: center;">
                <svg width="160" height="50" viewBox="0 0 320 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="usergy-gradient-resend" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                      <stop stop-color="#ffffff"/>
                      <stop offset="1" stop-color="#f8fafc"/>
                    </linearGradient>
                    <linearGradient id="text-gradient-resend" x1="60" y1="40" x2="320" y2="40" gradientUnits="userSpaceOnUse">
                      <stop stop-color="#ffffff"/>
                      <stop offset="1" stop-color="#f8fafc"/>
                    </linearGradient>
                  </defs>
                  <rect x="0" y="20" width="40" height="40" rx="10" fill="url(#usergy-gradient-resend)"/>
                  <g transform="translate(8,28)">
                    <circle cx="6" cy="12" r="3" fill="#00C6FB"/>
                    <circle cx="18" cy="6" r="3" fill="#00C6FB"/>
                    <circle cx="18" cy="18" r="3" fill="#00C6FB"/>
                    <path d="M8.5 14l7-4" stroke="#00C6FB" stroke-width="2"/>
                    <path d="M8.5 10l7 4" stroke="#00C6FB" stroke-width="2"/>
                  </g>
                  <text x="60" y="54" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="44" font-weight="bold" fill="url(#text-gradient-resend)">
                    Usergy
                  </text>
                </svg>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">New Verification Code</h1>
              <p style="color: #e2e8f0; margin: 10px 0 0; font-size: 16px;">Usergy Client Portal</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1a202c; margin: 0 0 20px; font-size: 24px; font-weight: 600;">Fresh Verification Code</h2>
              
              <p style="color: #4a5568; margin: 0 0 20px; font-size: 16px; line-height: 1.6;">
                Hi <strong>${firstName}</strong>,
              </p>
              
              <p style="color: #4a5568; margin: 0 0 30px; font-size: 16px; line-height: 1.6;">
                As requested, here's your new verification code for the Usergy Client Portal:
              </p>
              
              <!-- OTP Code Box -->
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
                <p style="color: #ffffff; margin: 0 0 10px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 500;">New Verification Code</p>
                <div style="background-color: #ffffff; border-radius: 8px; padding: 20px; margin: 10px 0;">
                  <span style="color: #1a202c; font-size: 36px; font-weight: 700; letter-spacing: 6px; font-family: 'Courier New', monospace;">${otpCode}</span>
                </div>
                <p style="color: #e2e8f0; margin: 10px 0 0; font-size: 14px;">Expires in 10 minutes</p>
              </div>
              
              <div style="background-color: #fff5f5; border-left: 4px solid #f56565; padding: 16px; margin: 30px 0;">
                <p style="color: #742a2a; margin: 0; font-size: 14px; line-height: 1.5;">
                  <strong>Important:</strong> Your previous verification code has been invalidated. Please use only this new code to complete your email verification.
                </p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f7fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #718096; margin: 0 0 10px; font-size: 14px;">
                Best regards,<br>
                <strong>The Usergy Team</strong>
              </p>
              <div style="margin: 20px 0;">
                <a href="https://usergy.ai" style="color: #667eea; text-decoration: none; font-size: 14px; margin: 0 10px;">Website</a>
                <span style="color: #cbd5e0;">|</span>
                <a href="mailto:support@usergy.ai" style="color: #667eea; text-decoration: none; font-size: 14px; margin: 0 10px;">Support</a>
              </div>
              <p style="color: #a0aec0; margin: 0; font-size: 12px;">
                © 2024 Usergy Technologies. All rights reserved.
              </p>
            </div>
            
          </div>
        </body>
        </html>
      `
    });

    console.log('Resend email sent successfully:', emailResult);
    
    // Log successful email delivery
    await supabase.from('error_logs').insert({
      error_type: 'info',
      error_message: 'OTP resend email sent successfully',
      context: 'otp_resend_email',
      metadata: {
        email,
        email_id: emailResult.data?.id
      }
    });

  } catch (emailError) {
    console.error('Email sending error:', emailError);
    
    // Log email delivery failure
    await supabase.from('error_logs').insert({
      error_type: 'email_delivery_error',
      error_message: emailError.message,
      context: 'otp_resend_email',
      metadata: {
        email,
        error_detail: emailError
      }
    });
    
    return new Response(
      JSON.stringify({ error: 'Failed to send verification email. Please try again or contact support.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: 'New verification code sent to your email.' 
    }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}

serve(handler);