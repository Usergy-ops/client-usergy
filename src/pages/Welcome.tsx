
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, Shield, Users, ArrowRight, CheckCircle } from 'lucide-react';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { UnifiedClientSignUpForm } from '@/components/client/UnifiedClientSignUpForm';
import { ClientSignInForm } from '@/components/client/ClientSignInForm';
import { UseryLogo } from '@/components/client/UseryLogo';

export default function Welcome() {
  const { user, loading, isClientAccount } = useClientAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('signup');

  // Redirect authenticated users
  useEffect(() => {
    if (!loading && user && isClientAccount) {
      console.log('User authenticated and is client, redirecting to dashboard...');
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, isClientAccount, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show login/signup for unauthenticated users
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-screen">
          {/* Left Side - Hero Content */}
          <div className="space-y-8">
            <div className="space-y-6">
              <UseryLogo className="h-12 w-auto" />
              <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-tight">
                Welcome to{' '}
                <span className="text-primary">Usergy</span>
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed">
                The intelligent energy management platform that helps businesses 
                optimize their energy consumption and reduce costs.
              </p>
            </div>

            {/* Feature highlights */}
            <div className="grid gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <span className="text-foreground">Real-time energy monitoring</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <Shield className="w-4 h-4 text-primary" />
                </div>
                <span className="text-foreground">Advanced analytics & insights</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <span className="text-foreground">Enterprise-grade security</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Join thousands of businesses optimizing their energy usage</span>
            </div>
          </div>

          {/* Right Side - Auth Forms */}
          <div className="w-full max-w-md mx-auto">
            <Card className="shadow-xl border-0 bg-background/80 backdrop-blur-sm">
              <CardContent className="p-8">
                <div className="space-y-6">
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-foreground">Get Started</h2>
                    <p className="text-muted-foreground">
                      Create your account or sign in to continue
                    </p>
                  </div>

                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                      <TabsTrigger value="signup" className="text-sm">Sign Up</TabsTrigger>
                      <TabsTrigger value="signin" className="text-sm">Sign In</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="signup" className="space-y-4">
                      <UnifiedClientSignUpForm />
                    </TabsContent>
                    
                    <TabsContent value="signin" className="space-y-4">
                      <ClientSignInForm />
                    </TabsContent>
                  </Tabs>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
