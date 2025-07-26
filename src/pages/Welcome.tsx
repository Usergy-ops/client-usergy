import { useState } from 'react';
import { ClientSignUpForm } from '@/components/client/ClientSignUpForm';
import { ClientSignInForm } from '@/components/client/ClientSignInForm';
import { cn } from '@/lib/utils';
import { NetworkNodes } from '@/components/client/NetworkNodes';

export default function Welcome() {
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 relative overflow-hidden">
      <NetworkNodes />
      
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="container max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            
            {/* Hero Section - Left Side */}
            <div className="animate-fade-in space-y-8 lg:space-y-12">
              {/* Logo */}
              <div className="inline-flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-start to-primary-end rounded-lg flex items-center justify-center shadow-lg">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="6" r="3" />
                    <circle cx="18" cy="18" r="3" />
                    <path d="M8.5 14l7-4" stroke="white" strokeWidth="2" />
                    <path d="M8.5 10l7 4" stroke="white" strokeWidth="2" />
                  </svg>
                </div>
                <span className="text-3xl font-bold bg-gradient-to-r from-primary-start to-primary-end bg-clip-text text-transparent">
                  Usergy
                </span>
              </div>

              {/* Hero Headlines */}
              <div className="space-y-6">
                <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold text-foreground leading-tight">
                  Launch Products That
                  <span className="block bg-gradient-to-r from-primary-start to-primary-end bg-clip-text text-transparent">
                    Users Love
                  </span>
                </h1>

                <p className="text-xl lg:text-2xl text-muted-foreground leading-relaxed max-w-2xl">
                  Connect with expert testers who provide actionable insights to perfect your product before launch.
                </p>
              </div>

              {/* Trust Indicators */}
              <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-8 text-sm text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-success rounded-full animate-pulse-slow"></div>
                  <span>98% Launch Success Rate</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-primary-start rounded-full animate-pulse-slow"></div>
                  <span>10,000+ Expert Testers</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-primary-end rounded-full animate-pulse-slow"></div>
                  <span>24-Hour Turnaround</span>
                </div>
              </div>
            </div>

            {/* Auth Form Section - Right Side */}
            <div className="animate-slide-up">
              <div className="bg-card/80 backdrop-blur-sm usergy-shadow-strong rounded-3xl p-8 lg:p-10 border border-border/50">
                
                {/* Tab Toggle */}
                <div className="flex mb-8 p-1 bg-muted/30 rounded-xl backdrop-blur-sm">
                  <button
                    onClick={() => setAuthMode('signup')}
                    className={cn(
                      "flex-1 py-3 px-4 text-sm font-semibold rounded-lg transition-all duration-300",
                      authMode === 'signup'
                        ? "bg-white text-primary shadow-md"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Join Us
                  </button>
                  <button
                    onClick={() => setAuthMode('signin')}
                    className={cn(
                      "flex-1 py-3 px-4 text-sm font-semibold rounded-lg transition-all duration-300",
                      authMode === 'signin'
                        ? "bg-white text-primary shadow-md"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Welcome Back
                  </button>
                </div>

                {/* Form Header */}
                <div className="mb-8 text-center">
                  <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
                    {authMode === 'signup' 
                      ? 'Start your journey to product excellence' 
                      : 'Welcome back to your command center'}
                  </h2>
                  <p className="text-muted-foreground">
                    {authMode === 'signup' 
                      ? 'Join leading companies who trust Usergy for product validation' 
                      : 'Continue building products users love'}
                  </p>
                </div>

                {/* Form Content */}
                <div className="space-y-6">
                  {authMode === 'signup' ? (
                    <ClientSignUpForm />
                  ) : (
                    <ClientSignInForm />
                  )}
                </div>

                {/* Footer */}
                <div className="mt-8 text-center text-xs text-muted-foreground">
                  {authMode === 'signup' ? (
                    <>
                      Already part of our community?{' '}
                      <button 
                        onClick={() => setAuthMode('signin')}
                        className="text-primary hover:underline font-medium"
                      >
                        Welcome back
                      </button>
                    </>
                  ) : (
                    <>
                      New to Usergy?{' '}
                      <button 
                        onClick={() => setAuthMode('signup')}
                        className="text-primary hover:underline font-medium"
                      >
                        Start your journey
                      </button>
                    </>
                  )}
                </div>

                <div className="mt-6 text-center text-xs text-muted-foreground">
                  <a href="#" className="hover:text-foreground transition-colors">
                    Privacy Policy
                  </a>
                  {' • '}
                  <a href="#" className="hover:text-foreground transition-colors">
                    Terms of Service
                  </a>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}