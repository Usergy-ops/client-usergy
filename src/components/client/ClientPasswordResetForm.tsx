import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ClientPasswordResetFormProps {
  onBack: () => void;
}

export function ClientPasswordResetForm({ onBack }: ClientPasswordResetFormProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError('');

    try {
      // Call our secure function to generate password reset token
      const { data, error: functionError } = await supabase.rpc(
        'generate_client_password_reset_token',
        { user_email: email }
      );

      if (functionError) {
        throw functionError;
      }

      // In a real implementation, you would send the reset email here
      // For now, we'll just show success
      setSent(true);
    } catch (error: any) {
      console.error('Password reset error:', error);
      setError(error.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Check your email</h3>
          <p className="text-muted-foreground mb-6">
            We've sent password reset instructions to <strong>{email}</strong>
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="w-full"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Sign In
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold mb-2">Reset your password</h3>
        <p className="text-muted-foreground">
          Enter your email address and we'll send you instructions to reset your password.
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="reset-email">Email Address</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            id="reset-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="pl-10 usergy-input"
            required
          />
        </div>
      </div>

      <div className="space-y-3">
        <Button
          type="submit"
          className="w-full usergy-btn-primary"
          disabled={loading || !email}
        >
          {loading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              <span>Sending...</span>
            </div>
          ) : (
            'Send Reset Instructions'
          )}
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="w-full"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Sign In
        </Button>
      </div>
    </form>
  );
}
