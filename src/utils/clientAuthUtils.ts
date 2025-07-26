
import { supabase } from '@/lib/supabase';

export interface RateLimitCheck {
  isAllowed: boolean;
  remainingAttempts?: number;
  resetTime?: Date;
}

export const checkClientSignInRateLimit = async (identifier: string): Promise<RateLimitCheck> => {
  try {
    const { data, error } = await supabase
      .from('enhanced_rate_limits')
      .select('*')
      .eq('identifier', identifier)
      .eq('action', 'client_signin')
      .gte('window_end', new Date().toISOString())
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Rate limit check error:', error);
      return { isAllowed: true }; // Fail open for now
    }

    if (!data) {
      return { isAllowed: true };
    }

    const maxAttempts = 5; // 5 attempts per hour
    const isBlocked = data.blocked_until && new Date(data.blocked_until) > new Date();
    
    if (isBlocked) {
      return {
        isAllowed: false,
        resetTime: new Date(data.blocked_until)
      };
    }

    const remainingAttempts = Math.max(0, maxAttempts - (data.attempts || 0));
    
    return {
      isAllowed: remainingAttempts > 0,
      remainingAttempts,
      resetTime: new Date(data.window_end)
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return { isAllowed: true }; // Fail open
  }
};

export const recordClientSignInAttempt = async (
  identifier: string, 
  success: boolean
): Promise<void> => {
  try {
    const windowStart = new Date();
    const windowEnd = new Date(windowStart.getTime() + 60 * 60 * 1000); // 1 hour

    // Check current rate limit record
    const { data: existing } = await supabase
      .from('enhanced_rate_limits')
      .select('*')
      .eq('identifier', identifier)
      .eq('action', 'client_signin')
      .gte('window_end', windowStart.toISOString())
      .single();

    if (existing) {
      const newAttempts = (existing.attempts || 0) + 1;
      const maxAttempts = 5;
      
      let blocked_until = null;
      if (!success && newAttempts >= maxAttempts) {
        // Block for 1 hour
        blocked_until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      }

      await supabase
        .from('enhanced_rate_limits')
        .update({
          attempts: newAttempts,
          blocked_until,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      // Create new rate limit record
      await supabase
        .from('enhanced_rate_limits')
        .insert({
          identifier,
          action: 'client_signin',
          window_start: windowStart.toISOString(),
          window_end: windowEnd.toISOString(),
          attempts: 1,
          blocked_until: null
        });
    }
  } catch (error) {
    console.error('Failed to record sign-in attempt:', error);
  }
};

export const validateEmailFormat = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePasswordStrength = (password: string): { 
  isValid: boolean; 
  errors: string[] 
} => {
  const errors: string[] = [];
  
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[@$!%*?&]/.test(password)) {
    errors.push('Password must contain at least one special character (@$!%*?&)');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
