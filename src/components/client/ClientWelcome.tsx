import { useState } from 'react';
import { NetworkNodes } from './NetworkNodes';
import { UseryLogo } from './UseryLogo';
import { ClientSignUpForm } from './ClientSignUpForm';
import { ClientSignInForm } from './ClientSignInForm';
import { cn } from '@/lib/utils';

export function ClientWelcome() {
  const [activeTab, setActiveTab] = useState<'signup' | 'signin'>('signup');

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      <NetworkNodes />
      
      <div className="glass-card w-full max-w-md p-8 animate-in fade-in-0 slide-in-from-bottom-2 duration-700">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <UseryLogo className="h-10" />
        </div>

        {/* Tab Navigation */}
        <div className="flex mb-8 p-1 bg-muted/30 rounded-xl backdrop-blur-sm">
          <button
            onClick={() => setActiveTab('signup')}
            className={cn(
              "flex-1 py-3 px-4 text-sm font-semibold rounded-lg transition-all duration-300",
              activeTab === 'signup'
                ? "bg-white text-primary shadow-md"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Join Us
          </button>
          <button
            onClick={() => setActiveTab('signin')}
            className={cn(
              "flex-1 py-3 px-4 text-sm font-semibold rounded-lg transition-all duration-300",
              activeTab === 'signin'
                ? "bg-white text-primary shadow-md"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Welcome Back
          </button>
        </div>

        {/* Form Content */}
        <div className="space-y-6">
          {activeTab === 'signup' ? (
            <ClientSignUpForm />
          ) : (
            <ClientSignInForm />
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-muted-foreground">
          By continuing, you agree to our{' '}
          <a href="#" className="text-primary hover:underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="#" className="text-primary hover:underline">
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
}