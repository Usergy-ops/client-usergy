
import { useState } from 'react';
import { Mail, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useClientAuth } from '@/contexts/ClientAuthContext';

export function EmailVerificationBanner() {
  const { user } = useClientAuth();
  const [isVisible, setIsVisible] = useState(true);
  const [isResending, setIsResending] = useState(false);
  const [resent, setResent] = useState(false);

  // Don't show if user is verified or banner is dismissed
  if (!user || user.email_confirmed_at || !isVisible) {
    return null;
  }

  const handleResendVerification = async () => {
    setIsResending(true);
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email!,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) throw error;
      
      setResent(true);
      setTimeout(() => setResent(false), 3000);
    } catch (error: any) {
      console.error('Error resending verification:', error);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Mail className="h-5 w-5 text-primary" />
          <div className="text-sm">
            <span className="font-medium">Please verify your email address.</span>
            <span className="text-muted-foreground ml-2">
              Check your inbox and click the verification link.
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {resent ? (
            <span className="text-sm text-success font-medium">Verification email sent!</span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={handleResendVerification}
              disabled={isResending}
              className="text-xs"
            >
              {isResending ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Sending...
                </>
              ) : (
                'Resend Email'
              )}
            </Button>
          )}
          
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsVisible(false)}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
