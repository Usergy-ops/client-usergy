import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NetworkNodes } from '@/components/client/NetworkNodes';
import { UseryLogo } from '@/components/client/UseryLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building, Globe, MapPin, Phone, Upload, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useClientAuth } from '@/contexts/ClientAuthContext';

interface CompanyProfile {
  companyName: string;
  websiteUrl: string;
  industry: string;
  companySize: string;
  contactRole: string;
  contactPhone: string;
  companyCountry: string;
  companyCity: string;
  companyTimezone: string;
  companyLogo?: File;
}

const industries = [
  'Technology/Software',
  'Artificial Intelligence',
  'E-commerce',
  'Fintech',
  'Healthcare/MedTech',
  'Education/EdTech',
  'Marketing/AdTech',
  'Gaming',
  'Blockchain/Crypto',
  'IoT/Hardware',
  'SaaS/B2B Tools',
  'Consumer Apps',
  'Other'
];

const companySizes = [
  { value: 'startup', label: 'Startup (1-10 employees)' },
  { value: 'small', label: 'Small (11-50 employees)' },
  { value: 'medium', label: 'Medium (51-200 employees)' },
  { value: 'enterprise', label: 'Enterprise (200+ employees)' }
];

const timezones = [
  'UTC-12:00 - International Date Line West',
  'UTC-11:00 - Coordinated Universal Time-11',
  'UTC-10:00 - Hawaii',
  'UTC-09:00 - Alaska',
  'UTC-08:00 - Pacific Time (US & Canada)',
  'UTC-07:00 - Mountain Time (US & Canada)',
  'UTC-06:00 - Central Time (US & Canada)',
  'UTC-05:00 - Eastern Time (US & Canada)',
  'UTC-04:00 - Atlantic Time (Canada)',
  'UTC-03:00 - Brasilia',
  'UTC-02:00 - Coordinated Universal Time-02',
  'UTC-01:00 - Azores',
  'UTC+00:00 - Greenwich Mean Time',
  'UTC+01:00 - Central European Time',
  'UTC+02:00 - Eastern European Time',
  'UTC+03:00 - Moscow',
  'UTC+04:00 - Gulf Standard Time',
  'UTC+05:00 - Pakistan Standard Time',
  'UTC+05:30 - India Standard Time',
  'UTC+06:00 - Bangladesh Standard Time',
  'UTC+07:00 - Indochina Time',
  'UTC+08:00 - China Standard Time',
  'UTC+09:00 - Japan Standard Time',
  'UTC+10:00 - Australian Eastern Standard Time',
  'UTC+11:00 - Coordinated Universal Time+11',
  'UTC+12:00 - New Zealand Standard Time'
];

export default function ProfileSetup() {
  const { user } = useClientAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState<CompanyProfile>({
    companyName: '',
    websiteUrl: '',
    industry: '',
    companySize: '',
    contactRole: '',
    contactPhone: '',
    companyCountry: '',
    companyCity: '',
    companyTimezone: '',
  });

  const updateFormData = (field: keyof CompanyProfile, value: string | File) => {
    if (field === 'companyLogo' && value instanceof File) {
      setFormData(prev => ({ ...prev, [field]: value }));
      const reader = new FileReader();
      reader.onload = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(value);
    } else {
      setFormData(prev => ({ ...prev, [field]: value as string }));
    }
    setError('');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Logo file size must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }
      updateFormData('companyLogo', file);
    }
  };

  const uploadLogo = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${user?.id}/logo.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('profile-pictures')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      console.error('Logo upload error:', uploadError);
      return null;
    }

    const { data } = supabase.storage
      .from('profile-pictures')
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    const requiredFields = ['companyName', 'industry', 'companySize', 'contactRole', 'companyCountry', 'companyCity', 'companyTimezone'];
    const missingFields = requiredFields.filter(field => !formData[field as keyof CompanyProfile]);
    
    if (missingFields.length > 0) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    
    try {
      let logoUrl = null;
      if (formData.companyLogo) {
        logoUrl = await uploadLogo(formData.companyLogo);
      }

      const { error } = await supabase
        .from('client_workspace.company_profiles')
        .insert({
          auth_user_id: user?.id,
          company_name: formData.companyName,
          company_website: formData.websiteUrl || null,
          industry: formData.industry,
          company_size: formData.companySize,
          contact_role: formData.contactRole,
          contact_phone: formData.contactPhone || null,
          company_country: formData.companyCountry,
          company_city: formData.companyCity,
          company_timezone: formData.companyTimezone,
          company_logo_url: logoUrl,
          onboarding_status: 'completed'
        });

      if (error) throw error;

      // Navigate to dashboard (would be created next)
      navigate('/dashboard');
    } catch (error: any) {
      setError(error.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative p-4">
      <NetworkNodes />
      
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 animate-in fade-in-0 slide-in-from-top-2">
          <UseryLogo className="h-10 mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-2">Complete Your Profile</h1>
          <p className="text-muted-foreground">
            Help us understand your company better to provide the best experience
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Error Message */}
          {error && (
            <div className="glass-card p-4 bg-destructive/10 border-destructive/20 animate-in slide-in-from-top-2">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Company Information */}
          <div className="glass-card p-6 space-y-6 animate-in fade-in-0 slide-in-from-bottom-2">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              Company Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => updateFormData('companyName', e.target.value)}
                  placeholder="Your Company Ltd"
                  className="usergy-input"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="websiteUrl">Website URL</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="websiteUrl"
                    value={formData.websiteUrl}
                    onChange={(e) => updateFormData('websiteUrl', e.target.value)}
                    placeholder="https://yourcompany.com"
                    className="pl-10 usergy-input"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="industry">Industry *</Label>
                <Select onValueChange={(value) => updateFormData('industry', value)}>
                  <SelectTrigger className="usergy-input">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map((industry) => (
                      <SelectItem key={industry} value={industry}>
                        {industry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="companySize">Company Size *</Label>
                <Select onValueChange={(value) => updateFormData('companySize', value)}>
                  <SelectTrigger className="usergy-input">
                    <SelectValue placeholder="Select company size" />
                  </SelectTrigger>
                  <SelectContent>
                    {companySizes.map((size) => (
                      <SelectItem key={size.value} value={size.value}>
                        {size.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Logo Upload */}
              <div className="md:col-span-2">
                <Label>Company Logo</Label>
                <div className="mt-2">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center justify-center w-24 h-24 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-muted/20 transition-colors">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain rounded-xl" />
                      ) : (
                        <Upload className="h-8 w-8 text-muted-foreground" />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">
                        Upload your company logo (max 5MB)
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Recommended: Square format, 200x200px minimum
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="glass-card p-6 space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 delay-100">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              Contact Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="contactRole">Your Role *</Label>
                <Input
                  id="contactRole"
                  value={formData.contactRole}
                  onChange={(e) => updateFormData('contactRole', e.target.value)}
                  placeholder="CEO, CTO, Product Manager, etc."
                  className="usergy-input"
                  required
                />
              </div>

              <div>
                <Label htmlFor="contactPhone">Phone Number</Label>
                <Input
                  id="contactPhone"
                  value={formData.contactPhone}
                  onChange={(e) => updateFormData('contactPhone', e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="usergy-input"
                />
              </div>
            </div>
          </div>

          {/* Location & Timezone */}
          <div className="glass-card p-6 space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 delay-200">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Location & Timezone
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="companyCountry">Country *</Label>
                <Input
                  id="companyCountry"
                  value={formData.companyCountry}
                  onChange={(e) => updateFormData('companyCountry', e.target.value)}
                  placeholder="United States"
                  className="usergy-input"
                  required
                />
              </div>

              <div>
                <Label htmlFor="companyCity">City *</Label>
                <Input
                  id="companyCity"
                  value={formData.companyCity}
                  onChange={(e) => updateFormData('companyCity', e.target.value)}
                  placeholder="San Francisco"
                  className="usergy-input"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="companyTimezone">Timezone *</Label>
                <Select onValueChange={(value) => updateFormData('companyTimezone', value)}>
                  <SelectTrigger className="usergy-input">
                    <Clock className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Select your timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((timezone) => (
                      <SelectItem key={timezone} value={timezone}>
                        {timezone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="text-center animate-in fade-in-0 slide-in-from-bottom-2 delay-300">
            <Button
              type="submit"
              className="usergy-btn-primary px-12 py-3 text-base"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  <span>Saving Profile...</span>
                </div>
              ) : (
                'Complete Setup'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}