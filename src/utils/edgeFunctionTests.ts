
// Edge Function Test Utilities
// Use these in browser console or create test components

export const testEdgeFunctionEndpoints = {
  // Test data
  testData: {
    signup: {
      email: 'test@client.usergy.ai',
      password: 'TestPass123!',
      companyName: 'Test Company',
      firstName: 'John',
      lastName: 'Doe'
    },
    otp: {
      email: 'test@client.usergy.ai',
      otpCode: '123456',
      password: 'TestPass123!'
    },
    resend: {
      email: 'test@client.usergy.ai'
    }
  },

  // Test signup endpoint
  testSignup: async () => {
    console.log('🧪 Testing signup endpoint...');
    try {
      const response = await fetch('https://lnsyrmpucmllakuuiixe.supabase.co/functions/v1/client-auth-handler/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxuc3lybXB1Y21sbGFrdXVpaXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNTI5MjQsImV4cCI6MjA2ODkyODkyNH0.kgdtlLTMLEHMBidAAB7fqP9_RhPXsqwI2Tv-TmmyF3Y`
        },
        body: JSON.stringify(testEdgeFunctionEndpoints.testData.signup)
      });
      
      const data = await response.json();
      console.log('✅ Signup Response:', data);
      console.log('📊 Status:', response.status);
      return { success: response.ok, data, status: response.status };
    } catch (error) {
      console.error('❌ Signup test failed:', error);
      return { success: false, error };
    }
  },

  // Test OTP verification endpoint
  testOTPVerification: async () => {
    console.log('🧪 Testing OTP verification endpoint...');
    try {
      const response = await fetch('https://lnsyrmpucmllakuuiixe.supabase.co/functions/v1/client-auth-handler/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxuc3lybXB1Y21sbGFrdXVpaXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNTI5MjQsImV4cCI6MjA2ODkyODkyNH0.kgdtlLTMLEHMBidAAB7fqP9_RhPXsqwI2Tv-TmmyF3Y`
        },
        body: JSON.stringify(testEdgeFunctionEndpoints.testData.otp)
      });
      
      const data = await response.json();
      console.log('✅ OTP Verification Response:', data);
      console.log('📊 Status:', response.status);
      return { success: response.ok, data, status: response.status };
    } catch (error) {
      console.error('❌ OTP verification test failed:', error);
      return { success: false, error };
    }
  },

  // Test resend OTP endpoint
  testResendOTP: async () => {
    console.log('🧪 Testing resend OTP endpoint...');
    try {
      const response = await fetch('https://lnsyrmpucmllakuuiixe.supabase.co/functions/v1/client-auth-handler/resend-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxuc3lybXB1Y21sbGFrdXVpaXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNTI5MjQsImV4cCI6MjA2ODkyODkyNH0.kgdtlLTMLEHMBidAAB7fqP9_RhPXsqwI2Tv-TmmyF3Y`
        },
        body: JSON.stringify(testEdgeFunctionEndpoints.testData.resend)
      });
      
      const data = await response.json();
      console.log('✅ Resend OTP Response:', data);
      console.log('📊 Status:', response.status);
      return { success: response.ok, data, status: response.status };
    } catch (error) {
      console.error('❌ Resend OTP test failed:', error);
      return { success: false, error };
    }
  },

  // Test all endpoints
  runAllTests: async () => {
    console.log('🚀 Running all edge function tests...\n');
    
    const results = {
      signup: await testEdgeFunctionEndpoints.testSignup(),
      resend: await testEdgeFunctionEndpoints.testResendOTP(),
      otp: await testEdgeFunctionEndpoints.testOTPVerification()
    };
    
    console.log('\n📋 Test Summary:');
    console.log('Signup:', results.signup.success ? '✅ PASS' : '❌ FAIL');
    console.log('Resend OTP:', results.resend.success ? '✅ PASS' : '❌ FAIL');
    console.log('OTP Verification:', results.otp.success ? '✅ PASS' : '❌ FAIL');
    
    return results;
  }
};

// CORS Test
export const testCORS = async () => {
  console.log('🧪 Testing CORS headers...');
  try {
    const response = await fetch('https://lnsyrmpucmllakuuiixe.supabase.co/functions/v1/client-auth-handler/signup', {
      method: 'OPTIONS'
    });
    
    console.log('✅ CORS Headers:', {
      'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers'),
      'Status': response.status
    });
    
    return response.ok;
  } catch (error) {
    console.error('❌ CORS test failed:', error);
    return false;
  }
};

// Console shortcuts - paste these directly into browser console
export const consoleCommands = {
  quickTest: `
// Quick test all endpoints
testEdgeFunctionEndpoints.runAllTests();

// Test individual endpoints
testEdgeFunctionEndpoints.testSignup();
testEdgeFunctionEndpoints.testResendOTP();
testEdgeFunctionEndpoints.testOTPVerification();

// Test CORS
testCORS();
`,
  
  curlCommands: `
# Test Signup
curl -X POST https://lnsyrmpucmllakuuiixe.supabase.co/functions/v1/client-auth-handler/signup \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxuc3lybXB1Y21sbGFrdXVpaXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNTI5MjQsImV4cCI6MjA2ODkyODkyNH0.kgdtlLTMLEHMBidAAB7fqP9_RhPXsqwI2Tv-TmmyF3Y" \\
  -d '{
    "email": "test@client.usergy.ai",
    "password": "TestPass123!",
    "companyName": "Test Company",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Test Resend OTP
curl -X POST https://lnsyrmpucmllakuuiixe.supabase.co/functions/v1/client-auth-handler/resend-otp \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxuc3lybXB1Y21sbGFrdXVpaXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNTI5MjQsImV4cCI6MjA2ODkyODkyNH0.kgdtlLTMLEHMBidAAB7fqP9_RhPXsqwI2Tv-TmmyF3Y" \\
  -d '{
    "email": "test@client.usergy.ai"
  }'

# Test OTP Verification
curl -X POST https://lnsyrmpucmllakuuiixe.supabase.co/functions/v1/client-auth-handler/verify-otp \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxuc3lybXB1Y21sbGFrdXVpaXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNTI5MjQsImV4cCI6MjA2ODkyODkyNH0.kgdtlLTMLEHMBidAAB7fqP9_RhPXsqwI2Tv-TmmyF3Y" \\
  -d '{
    "email": "test@client.usergy.ai",
    "otpCode": "123456",
    "password": "TestPass123!"
  }'

# Test CORS
curl -X OPTIONS https://lnsyrmpucmllakuuiixe.supabase.co/functions/v1/client-auth-handler/signup \\
  -H "Access-Control-Request-Method: POST" \\
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \\
  -v
`
};

// Export for global use
if (typeof window !== 'undefined') {
  (window as any).testEdgeFunctionEndpoints = testEdgeFunctionEndpoints;
  (window as any).testCORS = testCORS;
}
