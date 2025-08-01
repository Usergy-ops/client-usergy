
import React from 'react';
import { EmailSystemTester } from '@/components/client/EmailSystemTester';

export default function EmailSystemTest() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Email System Testing
            </h1>
            <p className="text-muted-foreground">
              Test and verify the email delivery system for OTP verification
            </p>
          </div>
          
          <EmailSystemTester />
        </div>
      </div>
    </div>
  );
}
