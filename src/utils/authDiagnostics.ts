import { supabase } from '@/integrations/supabase/client';

export interface AuthDiagnosticResult {
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: any;
}

export interface AuthDiagnosticReport {
  overall: 'healthy' | 'issues' | 'critical';
  results: {
    session: AuthDiagnosticResult;
    user: AuthDiagnosticResult;
    accountType: AuthDiagnosticResult;
    profile: AuthDiagnosticResult;
    connectivity: AuthDiagnosticResult;
  };
  recommendations: string[];
  debugInfo: any;
}

export async function runAuthDiagnostics(): Promise<AuthDiagnosticReport> {
  const results: AuthDiagnosticReport['results'] = {
    session: { status: 'error', message: 'Not checked' },
    user: { status: 'error', message: 'Not checked' },
    accountType: { status: 'error', message: 'Not checked' },
    profile: { status: 'error', message: 'Not checked' },
    connectivity: { status: 'error', message: 'Not checked' }
  };
  
  const recommendations: string[] = [];
  const debugInfo: any = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href
  };

  try {
    // Test Supabase connectivity
    try {
      const { data, error } = await supabase.from('account_types').select('count').limit(1);
      if (error) {
        results.connectivity = {
          status: 'error',
          message: 'Database connection failed',
          details: error
        };
        recommendations.push('Check your internet connection and Supabase configuration');
      } else {
        results.connectivity = {
          status: 'success',
          message: 'Database connection successful'
        };
      }
    } catch (error) {
      results.connectivity = {
        status: 'error',
        message: 'Network connectivity issues',
        details: error
      };
      recommendations.push('Check your internet connection');
    }

    // Check session
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      debugInfo.session = session;
      
      if (sessionError) {
        results.session = {
          status: 'error',
          message: 'Session retrieval failed',
          details: sessionError
        };
        recommendations.push('Try refreshing the page or signing in again');
      } else if (!session) {
        results.session = {
          status: 'warning',
          message: 'No active session found'
        };
        recommendations.push('User needs to sign in');
      } else {
        // Check if session is expired
        const isExpired = session.expires_at && session.expires_at < Date.now() / 1000;
        if (isExpired) {
          results.session = {
            status: 'warning',
            message: 'Session has expired',
            details: { expiresAt: session.expires_at }
          };
          recommendations.push('Session expired - user needs to sign in again');
        } else {
          results.session = {
            status: 'success',
            message: 'Active session found'
          };
        }
      }
    } catch (error) {
      results.session = {
        status: 'error',
        message: 'Session check failed',
        details: error
      };
    }

    // Check user
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      debugInfo.user = user;
      
      if (userError) {
        results.user = {
          status: 'error',
          message: 'User retrieval failed',
          details: userError
        };
        recommendations.push('Authentication issue - try signing in again');
      } else if (!user) {
        results.user = {
          status: 'warning',
          message: 'No user found'
        };
        recommendations.push('User needs to sign in');
      } else {
        results.user = {
          status: 'success',
          message: 'User authenticated',
          details: { id: user.id, email: user.email }
        };
        
        // Check account type
        try {
          const { data: accountData, error: accountError } = await supabase
            .from('account_types')
            .select('account_type')
            .eq('auth_user_id', user.id)
            .single();
            
          if (accountError) {
            results.accountType = {
              status: 'error',
              message: 'Account type check failed',
              details: accountError
            };
            recommendations.push('Account type not properly configured');
          } else {
            results.accountType = {
              status: 'success',
              message: `Account type: ${accountData.account_type}`,
              details: accountData
            };
          }
        } catch (error) {
          results.accountType = {
            status: 'error',
            message: 'Account type lookup failed',
            details: error
          };
        }
        
        // Check profile
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();
            
          if (profileError) {
            results.profile = {
              status: 'warning',
              message: 'Profile not found or incomplete',
              details: profileError
            };
            recommendations.push('Profile needs to be created or completed');
          } else {
            results.profile = {
              status: 'success',
              message: 'Profile found',
              details: { profileCompleted: profileData.profile_completed }
            };
            
            if (!profileData.profile_completed) {
              recommendations.push('Profile setup needs to be completed');
            }
          }
        } catch (error) {
          results.profile = {
            status: 'error',
            message: 'Profile check failed',
            details: error
          };
        }
      }
    } catch (error) {
      results.user = {
        status: 'error',
        message: 'User check failed',
        details: error
      };
    }
  } catch (error) {
    debugInfo.generalError = error;
    recommendations.push('General system error - check console for details');
  }

  // Determine overall status
  const errorCount = Object.values(results).filter(r => r.status === 'error').length;
  const warningCount = Object.values(results).filter(r => r.status === 'warning').length;
  
  let overall: AuthDiagnosticReport['overall'] = 'healthy';
  if (errorCount > 0) {
    overall = 'critical';
  } else if (warningCount > 0) {
    overall = 'issues';
  }

  return {
    overall,
    results,
    recommendations,
    debugInfo
  };
}

export function logDiagnosticReport(report: AuthDiagnosticReport) {
  console.group('🔍 Authentication Diagnostics Report');
  console.log(`Overall Status: ${report.overall.toUpperCase()}`);
  
  console.group('📊 Results');
  Object.entries(report.results).forEach(([key, result]) => {
    const icon = result.status === 'success' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
    console.log(`${icon} ${key}: ${result.message}`);
    if (result.details) {
      console.log('  Details:', result.details);
    }
  });
  console.groupEnd();
  
  if (report.recommendations.length > 0) {
    console.group('💡 Recommendations');
    report.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
    console.groupEnd();
  }
  
  console.log('🐛 Debug Info:', report.debugInfo);
  console.groupEnd();
}
