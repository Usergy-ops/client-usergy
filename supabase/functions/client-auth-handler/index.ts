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

console.log('Enhanced edge function starting with config:', {
  supabaseUrl: supabaseUrl ? 'configured' : 'missing',
  serviceKey: supabaseServiceKey ? 'configured' : 'missing',
  resendKey: resendApiKey ? 'configured' : 'missing'
});

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Enhanced logging function
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

// Enhanced diagnostic logging
const logDiagnostic = async (level: string, message: string, context: string, data: any = {}) => {
  console.log(`[${level.toUpperCase()}] ${context}: ${message}`, data);
  try {
    await supabase.from('error_logs').insert({
      error_type: level,
      error_message: message,
      context,
      metadata: data,
    });
  } catch (dbError) {
    console.error('Failed to log diagnostic to database:', dbError);
  }
};

// Enhanced user existence check with multiple verification methods
const comprehensiveUserExistenceCheck = async (email: string): Promise<{
  exists: boolean;
  source: string;
  userDetails?: any;
  diagnostic: any;
}> => {
  const diagnostic = {
    email,
    timestamp: new Date().toISOString(),
    checks: {} as any
  };

  try {
    // Method 1: Admin API check (most comprehensive but can have false positives)
    let adminUsers = [];
    try {
      const { data: adminData, error: adminError } = await supabase.auth.admin.listUsers();
      
      if (adminError) {
        console.error('Admin API error:', adminError);
        diagnostic.checks.admin_api = { error: adminError.message, success: false };
      } else {
        adminUsers = adminData.users.filter(u => u.email === email);
        diagnostic.checks.admin_api = { 
          success: true, 
          total_users: adminData.users.length,
          matching_users: adminUsers.length,
          user_details: adminUsers.map(u => ({
            id: u.id,
            email: u.email,
            email_confirmed: !!u.email_confirmed_at,
            created_at: u.created_at,
            provider: u.app_metadata?.provider
          }))
        };
        console.log(`Admin API found ${adminUsers.length} users with email ${email}`);
      }
    } catch (error) {
      console.error('Admin API exception:', error);
      diagnostic.checks.admin_api = { error: error.message, success: false };
    }

    // Method 2: Database check via RPC function
    let dbUserExists = false;
    try {
      const { data: dbCheck, error: dbError } = await supabase.rpc('check_email_exists_for_account_type', {
        email_param: email,
        account_type_param: 'client'
      });
      
      if (dbError) {
        console.error('Database RPC error:', dbError);
        diagnostic.checks.database_rpc = { error: dbError.message, success: false };
      } else {
        dbUserExists = dbCheck;
        diagnostic.checks.database_rpc = { success: true, user_exists: dbUserExists };
        console.log(`Database RPC check: user exists = ${dbUserExists}`);
      }
    } catch (error) {
      console.error('Database RPC exception:', error);
      diagnostic.checks.database_rpc = { error: error.message, success: false };
    }

    // Method 3: Direct account_types table check
    let accountTypeExists = false;
    try {
      const { data: accountData, error: accountError } = await supabase
        .from('account_types')
        .select('auth_user_id, account_type, created_at')
        .eq('account_type', 'client');
      
      if (accountError) {
        console.error('Account types query error:', accountError);
        diagnostic.checks.account_types = { error: accountError.message, success: false };
      } else {
        // Cross-reference with admin users to find matching emails
        const matchingAccounts = [];
        if (adminUsers.length > 0) {
          for (const adminUser of adminUsers) {
            const accountMatch = accountData?.find(acc => acc.auth_user_id === adminUser.id);
            if (accountMatch) {
              matchingAccounts.push({
                user_id: adminUser.id,
                email: adminUser.email,
                account_type: accountMatch.account_type,
                created_at: accountMatch.created_at
              });
            }
          }
        }
        accountTypeExists = matchingAccounts.length > 0;
        diagnostic.checks.account_types = { 
          success: true, 
          matching_accounts: matchingAccounts.length,
          account_details: matchingAccounts
        };
        console.log(`Account types check: ${matchingAccounts.length} matching client accounts`);
      }
    } catch (error) {
      console.error('Account types exception:', error);
      diagnostic.checks.account_types = { error: error.message, success: false };
    }

    // Decision logic with enhanced reasoning
    let finalExists = false;
    let source = 'unknown';
    let userDetails = null;

    if (adminUsers.length > 0) {
      // Check if any admin users are confirmed/active
      const confirmedUsers = adminUsers.filter(u => u.email_confirmed_at);
      const unconfirmedUsers = adminUsers.filter(u => !u.email_confirmed_at);
      
      diagnostic.reasoning = {
        total_admin_users: adminUsers.length,
        confirmed_users: confirmedUsers.length,
        unconfirmed_users: unconfirmedUsers.length,
        db_user_exists: dbUserExists,
        account_type_exists: accountTypeExists
      };

      if (confirmedUsers.length > 0) {
        // Definitely exists - confirmed users
        finalExists = true;
        source = 'admin_api_confirmed';
        userDetails = confirmedUsers[0];
      } else if (accountTypeExists && dbUserExists) {
        // Cross-verified existence
        finalExists = true;
        source = 'cross_verified';
        userDetails = adminUsers[0];
      } else if (unconfirmedUsers.length > 0) {
        // Unconfirmed users - need cleanup
        console.warn(`Found ${unconfirmedUsers.length} unconfirmed users for ${email}`);
        
        // Check if users are very recent (within last hour) - might be legitimate pending signup
        const recentUsers = unconfirmedUsers.filter(u => {
          const createdAt = new Date(u.created_at);
          const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
          return createdAt > hourAgo;
        });

        if (recentUsers.length > 0) {
          // Recent unconfirmed users - likely legitimate
          finalExists = true;
          source = 'admin_api_recent_unconfirmed';
          userDetails = recentUsers[0];
        } else {
          // Old unconfirmed users - mark for cleanup
          finalExists = false;
          source = 'stale_unconfirmed_marked_cleanup';
          
          // Schedule cleanup
          await scheduleUserCleanup(unconfirmedUsers, email);
        }
      }
    } else if (dbUserExists || accountTypeExists) {
      // Database says user exists but admin API doesn't find them - data inconsistency
      finalExists = true;
      source = 'database_only';
      console.warn(`Data inconsistency: DB says user ${email} exists but admin API doesn't find them`);
    }

    diagnostic.final_decision = {
      exists: finalExists,
      source,
      reasoning: diagnostic.reasoning
    };

    await logDiagnostic('info', 'Enhanced user existence check completed', 'comprehensiveUserExistenceCheck', diagnostic);

    return {
      exists: finalExists,
      source,
      userDetails,
      diagnostic
    };

  } catch (error) {
    console.error('Comprehensive user check failed:', error);
    diagnostic.error = error.message;
    
    await logError(error, 'comprehensiveUserExistenceCheck', { email, diagnostic });
    
    // Fallback to simple admin check
    try {
      const { data: fallbackData, error: fallbackError } = await supabase.auth.admin.listUsers({ email });
      if (!fallbackError && fallbackData.users.length > 0) {
        return {
          exists: true,
          source: 'fallback_admin_check',
          userDetails: fallbackData.users[0],
          diagnostic: { ...diagnostic, fallback_used: true }
        };
      }
    } catch (fallbackErr) {
      console.error('Fallback check also failed:', fallbackErr);
    }

    return {
      exists: false,
      source: 'error_fallback',
      diagnostic: { ...diagnostic, error: error.message }
    };
  }
};

// User cleanup function for stale unconfirmed accounts
const scheduleUserCleanup = async (users: any[], email: string) => {
  try {
    console.log(`Scheduling cleanup for ${users.length} stale unconfirmed users with email ${email}`);
    
    for (const user of users) {
      const userAge = Date.now() - new Date(user.created_at).getTime();
      const hoursOld = userAge / (1000 * 60 * 60);
      
      // Only cleanup users older than 24 hours
      if (hoursOld > 24) {
        console.log(`Cleaning up stale user ${user.id} (${hoursOld.toFixed(1)} hours old)`);
        
        try {
          const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
          if (deleteError) {
            console.error(`Failed to delete stale user ${user.id}:`, deleteError);
          } else {
            console.log(`Successfully cleaned up stale user ${user.id}`);
          }
        } catch (deleteErr) {
          console.error(`Exception deleting stale user ${user.id}:`, deleteErr);
        }
      }
    }

    await logDiagnostic('info', 'User cleanup completed', 'scheduleUserCleanup', {
      email,
      users_processed: users.length,
      cleanup_initiated: true
    });

  } catch (error) {
    console.error('User cleanup failed:', error);
    await logError(error, 'scheduleUserCleanup', { email, user_count: users.length });
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

    console.log(`Enhanced edge function called with path: ${path}, method: ${req.method}`);

    switch (path) {
      case 'signup':
        return await handleEnhancedClientSignup(req);
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
    console.error('Enhanced edge function main error:', error);
    await logError(error, 'client-auth-handler-main-enhanced');
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

async function handleEnhancedClientSignup(req: Request): Promise<Response> {
  const { email, password, companyName, firstName, lastName }: ClientSignupRequest = await req.json();

  try {
    console.log(`Starting enhanced client signup for: ${email}`);
    
    await logDiagnostic('info', 'Enhanced signup initiated', 'handleEnhancedClientSignup', {
      email,
      companyName,
      firstName,
      lastName
    });

    // Enhanced user existence check
    const existenceCheck = await comprehensiveUserExistenceCheck(email);
    
    if (existenceCheck.exists) {
      console.log(`Enhanced check: User exists (${existenceCheck.source}):`, existenceCheck.userDetails);
      
      const errorMessage = existenceCheck.source === 'admin_api_recent_unconfirmed' 
        ? 'A signup is already in progress for this email. Please check your email for verification or try again in a few minutes.'
        : 'User with this email already exists';

      await logDiagnostic('warning', 'Signup blocked - user exists', 'handleEnhancedClientSignup', {
        email,
        existence_source: existenceCheck.source,
        diagnostic: existenceCheck.diagnostic
      });

      return new Response(JSON.stringify({ 
        error: errorMessage,
        diagnostic: existenceCheck.diagnostic,
        can_retry: existenceCheck.source === 'stale_unconfirmed_marked_cleanup'
      }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    console.log(`Enhanced check: User does not exist (${existenceCheck.source}), proceeding with signup`);

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
        email_verified: false,
        signup_source: 'enhanced_client_signup'
      }
    });

    if (authError) {
      console.error('Enhanced signup: Error creating user:', authError);
      await logError(authError, 'handleEnhancedClientSignup-createUser', { email });
      return new Response(JSON.stringify({ error: 'Failed to create account.' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    console.log(`Enhanced signup: User created successfully: ${authData.user.id}`);

    // Store OTP for verification
    const { error: otpError } = await supabase.from('user_otp_verification').insert({
      email,
      otp_code: otpCode,
      expires_at: expiresAt.toISOString(),
    });

    if (otpError) {
      console.error('Enhanced signup: Error storing OTP:', otpError);
      await logError(otpError, 'handleEnhancedClientSignup-storeOTP', { email });
      return new Response(JSON.stringify({ error: 'Failed to generate verification code' }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    console.log(`Enhanced signup: OTP stored successfully for ${email}`);

    // Send OTP email
    if (resend) {
      try {
        await sendOTPEmailWithRetry(email, otpCode, firstName);
        console.log(`Enhanced signup: OTP email sent successfully to ${email}`);
      } catch (emailError) {
        console.error(`Enhanced signup: Failed to send OTP email to ${email}:`, emailError);
        await logError(emailError, 'handleEnhancedClientSignup-sendEmail', { email });
      }
    } else {
      console.warn('RESEND_API_KEY not configured, email will not be sent');
    }

    await logDiagnostic('info', 'Enhanced signup completed successfully', 'handleEnhancedClientSignup', {
      email,
      user_id: authData.user.id,
      emailSent: !!resend
    });

    return new Response(JSON.stringify({ 
      success: true, 
      userId: authData.user.id,
      message: 'Account created successfully. Please check your email for the verification code.',
      emailSent: !!resend,
      diagnostic: existenceCheck.diagnostic
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });

  } catch (error: any) {
    console.error('Enhanced signup unexpected error:', error);
    await logError(error, 'handleEnhancedClientSignup-catchAll', { email });
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
      return;

    } catch (error) {
      console.error(`Email send attempt ${attempt} failed for ${email}:`, error);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

serve(handler);
