
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY');

console.log('Edge function starting with config:', {
  supabaseUrl: supabaseUrl ? 'configured' : 'missing',
  serviceKey: supabaseServiceKey ? 'configured' : 'missing',
  resendKey: resendApiKey ? 'configured' : 'missing'
});

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Helper to log errors to the database
const logError = async (error: any, context: string, metadata: any = {}) => {
  console.error(`Error in ${context}:`, error);
  try {
    await supabase.from('error_logs').insert({
      error_type: 'edge_function_error',
      error_message: error.message,
      error_stack: error.stack,
      context,
      metadata: { ...metadata, error: error.toString() },
    });
  } catch (dbError) {
    console.error('Failed to log error to database:', dbError);
  }
};

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
  password?: string;
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

    console.log(`Edge function called with path: ${path}, method: ${req.method}`);

    switch (path) {
      case 'signup':
        return await handleClientSignup(req);
      case 'verify-otp':
        return await handleOTPVerification(req);
      case 'resend-otp':
        return await handleResendOTP(req);
      default:
        console.error(`Invalid endpoint: ${path}`);
        return new Response(JSON.stringify({ error: 'Invalid endpoint' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }
  } catch (error: any) {
    console.error('Edge function main error:', error);
    await logError(error, 'client-auth-handler-main');
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
    console.log(`Starting client signup for: ${email}`);
    
    // Check if user already exists
    const { data: existingUsers, error: userCheckError } = await supabase.auth.admin.listUsers({ email });

    if (userCheckError) {
      console.error('Error checking existing users:', userCheckError);
      await logError(userCheckError, 'handleClientSignup-userCheck', { email });
      return new Response(JSON.stringify({ error: 'Failed to check user existence.' }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    if (existingUsers.users.length > 0) {
      console.log(`User already exists: ${email}`);
      return new Response(JSON.stringify({ error: 'User with this email already exists' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    // Generate OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    console.log(`Generated OTP: ${otpCode} for ${email}, expires at: ${expiresAt.toISOString()}`);

    // Create user as UNCONFIRMED initially
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // User starts unconfirmed
      user_metadata: {
        account_type: 'client',
        companyName,
        contactFirstName: firstName,
        contactLastName: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
        email_verified: false // Track our own verification status
      }
    });

    if (authError) {
      console.error('Error creating user:', authError);
      await logError(authError, 'handleClientSignup-createUser', { email });
      return new Response(JSON.stringify({ error: 'Failed to create account.' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    console.log(`User created successfully: ${authData.user.id}, email confirmed: ${authData.user.email_confirmed_at}`);

    // Store OTP for verification
    const { error: otpError } = await supabase.from('user_otp_verification').insert({
      email,
      otp_code: otpCode,
      expires_at: expiresAt.toISOString(),
    });

    if (otpError) {
      console.error('Error storing OTP:', otpError);
      await logError(otpError, 'handleClientSignup-storeOTP', { email });
      return new Response(JSON.stringify({ error: 'Failed to generate verification code' }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    console.log(`OTP stored successfully in database for ${email}`);

    // Send OTP email (with retry logic)
    if (resend) {
      try {
        await sendOTPEmailWithRetry(email, otpCode, firstName);
        console.log(`OTP email sent successfully to ${email}`);
      } catch (emailError) {
        console.error(`Failed to send OTP email to ${email}:`, emailError);
        await logError(emailError, 'handleClientSignup-sendEmail', { email });
        // Don't fail the signup if email sending fails
      }
    } else {
      console.warn('RESEND_API_KEY not configured, email will not be sent');
      await logError(
        new Error('RESEND_API_KEY not configured'), 
        'handleClientSignup-emailConfig', 
        { email }
      );
    }

    console.log(`Signup process completed successfully for: ${email}`);
    return new Response(JSON.stringify({ 
      success: true, 
      userId: authData.user.id,
      message: 'Account created successfully. Please check your email for the verification code.',
      emailSent: !!resend
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });

  } catch (error: any) {
    console.error('Unexpected signup error:', error);
    await logError(error, 'handleClientSignup-catchAll', { email });
    return new Response(JSON.stringify({ error: 'An unexpected error occurred during signup.' }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  }
}

async function handleOTPVerification(req: Request): Promise<Response> {
  const { email, otpCode, password }: ClientOTPVerificationRequest = await req.json();

  try {
    console.log(`Starting OTP verification for ${email} with code: ${otpCode}`);
    
    // Find and validate OTP
    const { data: otpData, error: otpError } = await supabase
      .from('user_otp_verification')
      .select('*')
      .eq('email', email)
      .eq('otp_code', otpCode)
      .is('verified_at', null)
      .single();

    if (otpError || !otpData) {
      console.log(`Invalid OTP for ${email}: ${otpError?.message || 'OTP not found'}`);
      await logError(otpError, 'handleOTPVerification-findOTP', { email, otpCode });
      return new Response(JSON.stringify({ error: 'Invalid or expired verification code.' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    // Check if OTP has expired
    if (new Date() > new Date(otpData.expires_at)) {
      console.log(`Expired OTP for ${email}`);
      return new Response(JSON.stringify({ error: 'Verification code has expired. Please request a new one.' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    console.log(`Valid OTP found for ${email}, proceeding with verification`);

    // Get user record
    const { data: userData, error: userError } = await supabase.auth.admin.listUsers({ email });
    if (userError || !userData.users.length) {
      console.error(`User not found for ${email}:`, userError);
      await logError(userError, 'handleOTPVerification-findUser', { email });
      return new Response(JSON.stringify({ error: 'User account not found.' }), { 
        status: 404, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    const user = userData.users[0];
    console.log(`User found: ${user.id}, confirming email and creating session`);

    // Mark email as confirmed and update user metadata
    const { error: confirmError } = await supabase.auth.admin.updateUserById(user.id, {
      email_confirm: true,
      user_metadata: { 
        ...user.user_metadata, 
        email_verified: true,
        verification_completed_at: new Date().toISOString()
      }
    });

    if (confirmError) {
      console.error(`Failed to confirm email for ${user.id}:`, confirmError);
      await logError(confirmError, 'handleOTPVerification-confirmEmail', { userId: user.id });
    }

    // Mark OTP as verified
    const { error: markUsedError } = await supabase
      .from('user_otp_verification')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', otpData.id);

    if (markUsedError) {
      console.error('Failed to mark OTP as verified:', markUsedError);
    }

    // Create session for the user
    let sessionData = null;
    if (password) {
      console.log(`Creating session for verified user: ${email}`);
      const { data: signInData, error: sessionError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (sessionError) {
        console.error(`Failed to create session for ${email}:`, sessionError);
        await logError(sessionError, 'handleOTPVerification-signIn', { email });
        // Don't fail verification if session creation fails
      } else {
        sessionData = signInData;
        console.log(`Session created successfully for ${email}`);
      }
    }

    console.log(`OTP verification completed successfully for ${email}`);
    return new Response(JSON.stringify({ 
      success: true, 
      userId: user.id, 
      session: sessionData,
      message: 'Email verified successfully!'
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });

  } catch (error: any) {
    console.error(`OTP verification error for ${email}:`, error);
    await logError(error, 'handleOTPVerification-catchAll', { email });
    return new Response(JSON.stringify({ error: 'Verification failed. Please try again.' }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  }
}

async function handleResendOTP(req: Request): Promise<Response> {
  const { email }: ClientResendOTPRequest = await req.json();

  try {
    console.log(`Resending OTP for: ${email}`);

    // Check if user exists and is unverified
    const { data: userData, error: userError } = await supabase.auth.admin.listUsers({ email });
    if (userError || !userData.users.length) {
      console.log(`User not found for resend request: ${email}`);
      return new Response(JSON.stringify({ error: 'User account not found.' }), { 
        status: 404, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    const user = userData.users[0];
    
    // Generate new OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    console.log(`Generated new OTP: ${otpCode} for ${email}`);

    // Invalidate old OTPs for this email
    const { error: invalidateError } = await supabase
      .from('user_otp_verification')
      .update({ verified_at: new Date().toISOString() })
      .eq('email', email)
      .is('verified_at', null);

    if (invalidateError) {
      console.error('Error invalidating old OTPs:', invalidateError);
    }

    // Store new OTP
    const { error: otpError } = await supabase
      .from('user_otp_verification')
      .insert({
        email,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
      });

    if (otpError) {
      console.error('OTP storage error:', otpError);
      await logError(otpError, 'handleResendOTP-storeOTP', { email });
      return new Response(
        JSON.stringify({ error: 'Failed to generate verification code' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Get user's first name from metadata
    const firstName = user.user_metadata?.contactFirstName || 'there';

    // Send new OTP email with retry
    if (resend) {
      try {
        await sendOTPEmailWithRetry(email, otpCode, firstName, true);
        console.log(`Resend OTP email sent successfully to ${email}`);
      } catch (emailError) {
        console.error(`Failed to resend OTP email to ${email}:`, emailError);
        await logError(emailError, 'handleResendOTP-sendEmail', { email });
        // Don't fail the resend if email fails
      }
    }

    console.log(`OTP resend completed successfully for: ${email}`);
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'New verification code sent to your email.',
        emailSent: !!resend
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error(`Resend OTP error for ${email}:`, error);
    await logError(error, 'handleResendOTP-catchAll', { email });
    return new Response(
      JSON.stringify({ error: 'Failed to resend verification code' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

async function sendOTPEmailWithRetry(email: string, otpCode: string, firstName: string, isResend = false, maxRetries = 3): Promise<void> {
  if (!resend) {
    throw new Error('Resend not configured');
  }

  const subject = isResend ? 'New Verification Code - Usergy Client Portal' : 'Welcome to Usergy - Verify Your Email';
  const title = isResend ? 'New Verification Code' : 'Welcome to Usergy';
  const subtitle = isResend ? 'New Verification Code' : 'Email Verification Required';
  const message = isResend 
    ? 'As requested, here\'s your new verification code for the Usergy Client Portal:'
    : 'Thank you for signing up for the Usergy Client Portal. To complete your registration and access your dashboard, please verify your email address using the verification code below:';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Sending email attempt ${attempt} to ${email}`);
      
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

      console.log(`Email sent successfully on attempt ${attempt} to ${email}`);
      return; // Success, exit the retry loop

    } catch (error) {
      console.error(`Email send attempt ${attempt} failed for ${email}:`, error);
      
      if (attempt === maxRetries) {
        throw error; // Re-throw on final attempt
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

serve(handler);
