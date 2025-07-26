import { useState } from 'react';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff, Mail, Lock, Building, User, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClientSignUpData {
  email: string;
  password: string;
  companyName: string;
  contactFirstName: string;
  contactLastName: string;
  acceptTerms: boolean;
}

const passwordRequirements = [
  { regex: /.{8,}/, text: 'At least 8 characters' },
  { regex: /[A-Z]/, text: 'One uppercase letter' },
  { regex: /[a-z]/, text: 'One lowercase letter' },
  { regex: /[0-9]/, text: 'One number' },
  { regex: /[@$!%*?&]/, text: 'One special character' },
];

export function ClientSignUpForm() {
  const { signUp } = useClientAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<ClientSignUpData>({
    email: '',
    password: '',
    companyName: '',
    contactFirstName: '',
    contactLastName: '',
    acceptTerms: false,
  });

  const updateFormData = (field: keyof ClientSignUpData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const disposableEmailDomains = ['10minutemail.com', 'guerrillamail.com', 'tempmail.com'];
    const domain = email.split('@')[1];
    
    if (!emailRegex.test(email)) return 'Please enter a valid email address';
    if (disposableEmailDomains.includes(domain)) return 'Disposable email addresses are not allowed';
    return null;
  };

  const validatePassword = (password: string) => {
    return passwordRequirements.every(req => req.regex.test(password));
  };

  const getPasswordStrength = (password: string) => {
    const score = passwordRequirements.filter(req => req.regex.test(password)).length;
    if (score < 2) return { strength: 'weak', color: 'bg-red-500', width: '20%' };
    if (score < 4) return { strength: 'medium', color: 'bg-yellow-500', width: '60%' };
    return { strength: 'strong', color: 'bg-green-500', width: '100%' };
  };

  const handleNext = () => {
    if (step === 1) {
      const emailError = validateEmail(formData.email);
      if (emailError) {
        setError(emailError);
        return;
      }
      if (!validatePassword(formData.password)) {
        setError('Password does not meet requirements');
        return;
      }
    } else if (step === 2) {
      if (!formData.companyName || !formData.contactFirstName || !formData.contactLastName) {
        setError('Please fill in all required fields');
        return;
      }
    }
    
    setStep(step + 1);
    setError('');
  };

  const handleSubmit = async () => {
    if (!formData.acceptTerms) {
      setError('Please accept the terms and conditions');
      return;
    }

    setLoading(true);
    const { error } = await signUp(
      formData.email,
      formData.password,
      formData.companyName,
      formData.contactFirstName,
      formData.contactLastName
    );

    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  const passwordStrength = getPasswordStrength(formData.password);

  return (
    <div className="space-y-6">
      {/* Progress Dots */}
      <div className="flex justify-center space-x-2 mb-6">
        {[1, 2, 3].map((stepNum) => (
          <div
            key={stepNum}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              stepNum <= step ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 animate-in slide-in-from-top-2">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Step 1: Email & Password */}
      {step === 1 && (
        <div className="space-y-4 animate-in fade-in-0 slide-in-from-right-2">
          <div>
            <h2 className="text-xl font-semibold mb-2">Create Account</h2>
            <p className="text-sm text-muted-foreground">Let's get started with your credentials</p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormData('email', e.target.value)}
                  placeholder="your@company.com"
                  className="pl-10 usergy-input"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => updateFormData('password', e.target.value)}
                  placeholder="Create a strong password"
                  className="pl-10 pr-10 usergy-input"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password Strength */}
              {formData.password && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Password strength:</span>
                    <span className={cn(
                      "text-xs font-medium",
                      passwordStrength.strength === 'weak' ? 'text-red-500' :
                      passwordStrength.strength === 'medium' ? 'text-yellow-500' : 'text-green-500'
                    )}>
                      {passwordStrength.strength}
                    </span>
                  </div>
                  <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full transition-all duration-300", passwordStrength.color)}
                      style={{ width: passwordStrength.width }}
                    />
                  </div>
                  <div className="space-y-1">
                    {passwordRequirements.map((req, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        {req.regex.test(formData.password) ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <X className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span className={cn(
                          "text-xs",
                          req.regex.test(formData.password) ? 'text-green-500' : 'text-muted-foreground'
                        )}>
                          {req.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <Button 
            onClick={handleNext}
            className="w-full usergy-btn-primary"
            disabled={!formData.email || !formData.password}
          >
            Continue
          </Button>
        </div>
      )}

      {/* Step 2: Company & Contact Details */}
      {step === 2 && (
        <div className="space-y-4 animate-in fade-in-0 slide-in-from-right-2">
          <div>
            <h2 className="text-xl font-semibold mb-2">Company Details</h2>
            <p className="text-sm text-muted-foreground">Tell us about your company</p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="companyName">Company Name</Label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => updateFormData('companyName', e.target.value)}
                  placeholder="Your Company Ltd"
                  className="pl-10 usergy-input"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contactFirstName">First Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="contactFirstName"
                    value={formData.contactFirstName}
                    onChange={(e) => updateFormData('contactFirstName', e.target.value)}
                    placeholder="John"
                    className="pl-10 usergy-input"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="contactLastName">Last Name</Label>
                <Input
                  id="contactLastName"
                  value={formData.contactLastName}
                  onChange={(e) => updateFormData('contactLastName', e.target.value)}
                  placeholder="Doe"
                  className="usergy-input"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex space-x-3">
            <Button 
              onClick={() => setStep(step - 1)}
              variant="outline"
              className="flex-1 usergy-btn-secondary"
            >
              Back
            </Button>
            <Button 
              onClick={handleNext}
              className="flex-1 usergy-btn-primary"
              disabled={!formData.companyName || !formData.contactFirstName || !formData.contactLastName}
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Terms Acceptance */}
      {step === 3 && (
        <div className="space-y-4 animate-in fade-in-0 slide-in-from-right-2">
          <div>
            <h2 className="text-xl font-semibold mb-2">Almost Done!</h2>
            <p className="text-sm text-muted-foreground">Please review and accept our terms</p>
          </div>

          <div className="space-y-4 p-4 bg-muted/20 rounded-lg">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="acceptTerms"
                checked={formData.acceptTerms}
                onCheckedChange={(checked) => updateFormData('acceptTerms', !!checked)}
              />
              <label htmlFor="acceptTerms" className="text-sm leading-relaxed">
                I agree to Usergy's{' '}
                <a href="#" className="text-primary hover:underline">Terms of Service</a>,{' '}
                <a href="#" className="text-primary hover:underline">Privacy Policy</a>, and{' '}
                <a href="#" className="text-primary hover:underline">Data Processing Agreement</a>
              </label>
            </div>
          </div>

          <div className="flex space-x-3">
            <Button 
              onClick={() => setStep(step - 1)}
              variant="outline"
              className="flex-1 usergy-btn-secondary"
            >
              Back
            </Button>
            <Button 
              onClick={handleSubmit}
              className="flex-1 usergy-btn-primary"
              disabled={!formData.acceptTerms || loading}
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  <span>Creating Account...</span>
                </div>
              ) : (
                'Create Account'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}