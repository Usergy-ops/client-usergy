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

  // Send OTP email
  try {
    await resend.emails.send({
      from: 'Usergy Client Portal <noreply@usergy.ai>',
      to: [email],
      subject: 'Verify Your Email - Usergy Client Portal',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; text-align: center;">Welcome to Usergy!</h1>
          <h2 style="color: #666; text-align: center;">Email Verification Required</h2>
          
          <p>Hi ${firstName},</p>
          
          <p>Thank you for signing up for the Usergy Client Portal. To complete your registration, please verify your email address using the code below:</p>
          
          <div style="background: #f8f9fa; border: 2px solid #e9ecef; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <h2 style="color: #333; font-size: 32px; letter-spacing: 4px; margin: 0;">${otpCode}</h2>
          </div>
          
          <p>This code will expire in 10 minutes.</p>
          
          <p>If you didn't sign up for a Usergy account, you can safely ignore this email.</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #666; font-size: 14px; text-align: center;">
            © 2024 Usergy. All rights reserved.
          </p>
        </div>
      `
    });
  } catch (emailError) {
    console.error('Email sending error:', emailError);
    // Don't fail the signup if email fails
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

  // Confirm the user's email
  const { data: userData } = await supabase.auth.admin.listUsers();
  const user = userData.users.find(u => u.email === email);
  
  if (user) {
    await supabase.auth.admin.updateUserById(user.id, {
      email_confirm: true
    });
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: 'Email verified successfully! You can now sign in.' 
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

  // Send new OTP email
  try {
    await resend.emails.send({
      from: 'Usergy Client Portal <noreply@usergy.ai>',
      to: [email],
      subject: 'New Verification Code - Usergy Client Portal',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; text-align: center;">New Verification Code</h1>
          
          <p>Hi ${firstName},</p>
          
          <p>Here's your new verification code for the Usergy Client Portal:</p>
          
          <div style="background: #f8f9fa; border: 2px solid #e9ecef; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <h2 style="color: #333; font-size: 32px; letter-spacing: 4px; margin: 0;">${otpCode}</h2>
          </div>
          
          <p>This code will expire in 10 minutes.</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #666; font-size: 14px; text-align: center;">
            © 2024 Usergy. All rights reserved.
          </p>
        </div>
      `
    });
  } catch (emailError) {
    console.error('Email sending error:', emailError);
    return new Response(
      JSON.stringify({ error: 'Failed to send verification email' }),
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