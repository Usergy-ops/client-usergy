
export interface OTPEmailData {
  email: string;
  otpCode: string;
  companyName?: string;
  firstName?: string;
  lastName?: string;
  sourceUrl: string;
}

export function generateOTPEmailHTML(data: OTPEmailData): string {
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
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; 
            margin: 0; 
            padding: 0; 
            background-color: #f5f5f5; 
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: #ffffff; 
            padding: 40px 20px; 
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-top: 20px;
        }
        .header { 
            text-align: center; 
            margin-bottom: 40px; 
        }
        .logo { 
            font-size: 28px; 
            font-weight: bold; 
            color: #2563eb; 
            margin-bottom: 10px; 
        }
        .otp-container { 
            background-color: #f8fafc; 
            border: 2px solid #e2e8f0; 
            border-radius: 8px; 
            padding: 30px; 
            text-align: center; 
            margin: 30px 0; 
        }
        .otp-code { 
            font-size: 32px; 
            font-weight: bold; 
            color: #1e293b; 
            letter-spacing: 8px; 
            margin: 20px 0; 
            font-family: 'Courier New', monospace;
        }
        .footer { 
            text-align: center; 
            margin-top: 40px; 
            color: #64748b; 
            font-size: 14px; 
        }
        .warning { 
            background-color: #fef3cd; 
            border-left: 4px solid #f59e0b; 
            padding: 15px; 
            margin: 20px 0; 
            border-radius: 4px; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">USERGY</div>
            <h1 style="color: #1e293b; margin: 0;">Email Verification</h1>
        </div>
        
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            Hi ${displayName},
        </p>
        
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            ${welcomeMessage}
        </p>
        
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            To complete your account setup, please use the verification code below:
        </p>
        
        <div class="otp-container">
            <p style="color: #475569; margin: 0; font-size: 14px; margin-bottom: 10px;">Your verification code:</p>
            <div class="otp-code">${otpCode}</div>
            <p style="color: #64748b; margin: 0; font-size: 12px; margin-top: 10px;">This code expires in 10 minutes</p>
        </div>
        
        <div class="warning">
            <p style="color: #92400e; margin: 0; font-size: 14px;">
                <strong>Security Notice:</strong> Never share this code with anyone. Usergy will never ask for this code via phone or email.
            </p>
        </div>
        
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            If you didn't request this verification code, please ignore this email or contact our support team.
        </p>
        
        <div class="footer">
            <p>© 2025 Usergy. All rights reserved.</p>
            <p>This email was sent from <a href="${sourceUrl}" style="color: #2563eb;">${sourceUrl}</a></p>
        </div>
    </div>
</body>
</html>
  `;
}

export function generateOTPEmailText(data: OTPEmailData): string {
  const { email, otpCode, companyName, firstName, lastName } = data;
  const displayName = firstName && lastName ? `${firstName} ${lastName}` : email;
  const welcomeMessage = companyName ? `Welcome to Usergy! We're excited to have ${companyName} join our platform.` : 'Welcome to Usergy!';

  return `
Hi ${displayName},

${welcomeMessage}

To complete your account setup, please use the verification code below:

Verification Code: ${otpCode}

This code expires in 10 minutes.

SECURITY NOTICE: Never share this code with anyone. Usergy will never ask for this code via phone or email.

If you didn't request this verification code, please ignore this email or contact our support team.

© 2025 Usergy. All rights reserved.
  `.trim();
}
