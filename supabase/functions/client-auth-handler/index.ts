
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

  try {
    console.log('Starting signup process for:', email);
    
    const { data: existingUsers, error: userCheckError } = await supabase.auth.admin.listUsers();

    if (userCheckError) {
      console.error('Error checking existing users:', userCheckError);
      return new Response(
        JSON.stringify({ error: 'Failed to check existing users. Please try again.' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const existingUser = existingUsers.users.find(u => u.email === email);
    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'User with this email already exists' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Generate OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    console.log('Generated OTP:', otpCode, 'for email:', email);

    // Create user account
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        account_type: 'client',
        companyName,
        contactFirstName: firstName,
        contactLastName: lastName,
        email_verified: false
      }
    });

    if (authError) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Failed to create account. Please try again.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Store OTP
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

    // Send email asynchronously
    sendOTPEmail(email, otpCode, firstName).catch(error => {
      console.error('Email send error:', error);
    });

    console.log('Signup successful for:', email);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Account created successfully. Please check your email for verification code.',
        userId: authData.user.id
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('Signup error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

async function handleOTPVerification(req: Request): Promise<Response> {
  const { email, otpCode }: ClientOTPVerificationRequest = await req.json();

  try {
    console.log('Verifying OTP for:', email, 'Code:', otpCode);

    const { data: otpData, error: otpError } = await supabase
      .from('user_otp_verification')
      .select('*')
      .eq('email', email)
      .eq('otp_code', otpCode)
      .is('verified_at', null)
      .single();

    if (otpError || !otpData) {
      console.error('OTP not found or error:', otpError);
      return new Response(
        JSON.stringify({ error: 'Invalid verification code. Please try again.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Check if OTP is still valid
    const now = new Date();
    const expiresAt = new Date(otpData.expires_at);
    
    if (now > expiresAt) {
      console.log('OTP has expired');
      return new Response(
        JSON.stringify({ error: 'Verification code has expired. Please request a new one.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Mark OTP as verified
    const { error: updateError } = await supabase
      .from('user_otp_verification')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', otpData.id);

    if (updateError) {
      console.error('Error marking OTP as verified:', updateError);
    }

    // Get user by email
    const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error('Error getting users:', userError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify user' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const user = userData.users.find(u => u.email === email);
    
    if (!user) {
      console.error('User not found:', email);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Confirm email and update metadata
    const { error: confirmError } = await supabase.auth.admin.updateUserById(user.id, {
      email_confirm: true,
      user_metadata: {
        ...user.user_metadata,
        email_verified: true
      }
    });

    if (confirmError) {
      console.error('Error confirming email:', confirmError);
    }

    // Use the new ensure_client_account function
    const { data: createResult, error: createError } = await supabase.rpc('ensure_client_account', {
      user_id_param: user.id,
      company_name_param: user.user_metadata?.companyName || 'My Company',
      first_name_param: user.user_metadata?.contactFirstName || '',
      last_name_param: user.user_metadata?.contactLastName || ''
    });

    if (createError || !createResult?.success) {
      console.error('Error creating client account:', createError);
      // Don't fail the verification, just log the error
    }

    console.log('OTP verification successful for:', email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email verified successfully!',
        userId: user.id,
        redirectTo: '/dashboard'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('OTP verification error:', error);
    return new Response(
      JSON.stringify({ error: 'Verification failed. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

async function handleResendOTP(req: Request): Promise<Response> {
  const { email }: ClientResendOTPRequest = await req.json();

  try {
    console.log('Resending OTP for:', email);

    // Generate new OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    console.log('Generated new OTP:', otpCode, 'for email:', email);

    // Invalidate old OTPs and store new one
    const { error: invalidateError } = await supabase
      .from('user_otp_verification')
      .update({ verified_at: new Date().toISOString() })
      .eq('email', email)
      .is('verified_at', null);

    if (invalidateError) {
      console.error('Error invalidating old OTPs:', invalidateError);
    }

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
    const firstName = user?.user_metadata?.contactFirstName || 'there';

    // Send email asynchronously
    sendOTPEmail(email, otpCode, firstName, true).catch(console.error);

    console.log('OTP resent successfully for:', email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'New verification code sent to your email.' 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('Resend OTP error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to resend verification code' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

async function sendOTPEmail(email: string, otpCode: string, firstName: string, isResend = false): Promise<void> {
  const subject = isResend ? 'New Verification Code - Usergy Client Portal' : 'Welcome to Usergy - Verify Your Email';
  const title = isResend ? 'New Verification Code' : 'Welcome to Usergy';
  const subtitle = isResend ? 'New Verification Code' : 'Email Verification Required';
  const message = isResend 
    ? 'As requested, here\'s your new verification code for the Usergy Client Portal:'
    : 'Thank you for signing up for the Usergy Client Portal. To complete your registration and access your dashboard, please verify your email address using the verification code below:';

  await resend.emails.send({
    from: 'Usergy Client Portal <client@user.usergy.ai>',
    to: [email],
    subject,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          
          <!-- Header with Logo -->
          <div style="background: linear-gradient(135deg, #00C6FB 0%, #005BEA 100%); padding: 40px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">${title}</h1>
            <p style="color: #e2e8f0; margin: 10px 0 0; font-size: 16px;">Client Portal</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <h2 style="color: #1a202c; margin: 0 0 20px; font-size: 24px; font-weight: 600;">${subtitle}</h2>
            
            <p style="color: #4a5568; margin: 0 0 20px; font-size: 16px; line-height: 1.6;">
              Hi <strong>${firstName}</strong>,
            </p>
            
            <p style="color: #4a5568; margin: 0 0 30px; font-size: 16px; line-height: 1.6;">
              ${message}
            </p>
            
            <!-- OTP Code Box -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
              <p style="color: #ffffff; margin: 0 0 10px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 500;">Verification Code</p>
              <div style="background-color: #ffffff; border-radius: 8px; padding: 20px; margin: 10px 0;">
                <span style="color: #1a202c; font-size: 36px; font-weight: 700; letter-spacing: 6px; font-family: 'Courier New', monospace;">${otpCode}</span>
              </div>
              <p style="color: #e2e8f0; margin: 10px 0 0; font-size: 14px;">Expires in 10 minutes</p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f7fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #718096; margin: 0 0 10px; font-size: 14px;">
              Best regards,<br>
              <strong>The Usergy Team</strong>
            </p>
          </div>
          
        </div>
      </body>
      </html>
    `
  });
}

serve(handler);
