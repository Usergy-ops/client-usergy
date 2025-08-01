
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Building, User, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SignUpFormProps {
  onSuccess?: () => void;
  onSwitchToSignIn?: () => void;
}

export function SimpleClientSignUpForm({ onSuccess, onSwitchToSignIn }: SignUpFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Reset error on form changes
    setError('');
  }, [email, password, companyName, fullName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password || !companyName || !fullName) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            companyName: companyName,
            fullName: fullName,
            accountType: 'client'
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        setError(error.message || 'Signup failed. Please try again.');
        return;
      }

      // Handle success - call onSuccess callback
      console.log('Signup successful:', data);
      onSuccess?.();

    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-[400px]">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Create an account</CardTitle>
        <CardDescription>
          Enter your email below to create your account
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-2 rounded-md">
            {error}
          </div>
        )}
        <div className="flex items-center space-x-2">
          <Mail className="h-4 w-4 text-gray-500" />
          <div className="space-y-0.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              placeholder="your@email.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <User className="h-4 w-4 text-gray-500" />
          <div className="space-y-0.5">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              placeholder="John Doe"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Building className="h-4 w-4 text-gray-500" />
          <div className="space-y-0.5">
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              placeholder="Acme Inc."
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {showPassword ? (
            <EyeOff className="h-4 w-4 text-gray-500 cursor-pointer" onClick={() => setShowPassword(false)} />
          ) : (
            <Eye className="h-4 w-4 text-gray-500 cursor-pointer" onClick={() => setShowPassword(true)} />
          )}
          <div className="space-y-0.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              placeholder="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>
        <Button disabled={loading} onClick={handleSubmit}>
          {loading ? (
            <>
              Loading
            </>
          ) : (
            'Sign up'
          )}
        </Button>
        
        {onSwitchToSignIn && (
          <div className="text-center mt-4">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToSignIn}
                className="text-primary hover:underline"
              >
                Sign in
              </button>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
