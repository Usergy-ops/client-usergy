import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Building, User, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SignUpFormProps {
  onSuccess?: () => void;
}

export function EnhancedClientSignUpForm({ onSuccess }: SignUpFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Reset error on form changes
    setError('');
  }, [email, password, companyName, firstName, lastName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password || !companyName || !firstName || !lastName) {
      setError('All fields are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.functions.invoke('unified-auth', {
        body: {
          action: 'signup',
          email,
          password,
          companyName,
          firstName,
          lastName,
          accountType: 'client',
          sourceUrl: window.location.origin
        }
      });

      if (error) {
        console.error('Signup error:', error);
        setError(error.message || 'Signup failed. Please try again.');
        return;
      }

      if (data?.success) {
        console.log('Signup successful, check your email!');
        onSuccess?.();
      } else {
        setError(data?.error || 'Signup failed. Please try again.');
      }
    } catch (error: any) {
      console.error('Signup exception:', error);
      setError(error.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md space-y-4">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Create an Account</CardTitle>
        <CardDescription>Enter your details to create a client account</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-2 rounded-md">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="email"
                id="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 usergy-input"
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                id="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="usergy-input pr-10"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                <span className="sr-only">Show password</span>
              </Button>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="companyName">Company Name</Label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                id="companyName"
                placeholder="Your Company Name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="pl-10 usergy-input"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="firstName">First Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="text"
                  id="firstName"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="pl-10 usergy-input"
                  required
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName">Last Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="text"
                  id="lastName"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="pl-10 usergy-input"
                  required
                />
              </div>
            </div>
          </div>
          <Button type="submit" className="w-full usergy-btn-primary" disabled={loading}>
            {loading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Creating...</span>
              </div>
            ) : (
              'Create Account'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
