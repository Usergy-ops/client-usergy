import { ReactNode } from 'react';
import { EmailVerificationBanner } from './EmailVerificationBanner';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 relative overflow-hidden">
      <EmailVerificationBanner />
      <div className="relative z-10">
        <main className="container max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}