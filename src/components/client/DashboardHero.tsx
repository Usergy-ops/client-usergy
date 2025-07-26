import { Button } from '@/components/ui/button';
import { Rocket } from 'lucide-react';

interface DashboardHeroProps {
  companyName: string;
  activeProjects: number;
  totalUsersEngaged: number;
}

export function DashboardHero({ companyName, activeProjects, totalUsersEngaged }: DashboardHeroProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-primary-start/5 to-primary-end/10 border border-border/40 p-8 lg:p-12">
      {/* Animated SVG Pattern Background */}
      <div className="absolute inset-0 overflow-hidden opacity-10">
        <svg className="absolute -top-1/2 -left-1/2 w-full h-full" viewBox="0 0 100 100">
          <defs>
            <pattern id="heroPattern" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
              <circle cx="5" cy="5" r="1" fill="currentColor" className="text-primary">
                <animate attributeName="r" values="1;2;1" dur="4s" repeatCount="indefinite" />
              </circle>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#heroPattern)" />
        </svg>
      </div>

      <div className="relative z-10 grid lg:grid-cols-2 gap-8 items-center">
        <div className="space-y-6">
          <div className="space-y-4">
            <h1 className="text-3xl lg:text-4xl font-bold text-foreground">
              Welcome to your Command Center,{' '}
              <span className="gradient-text">{companyName}!</span>
            </h1>
            
            <p className="text-lg text-muted-foreground leading-relaxed">
              Launch projects, engage with top talent, and get actionable insights 
              to build products your users will love.
            </p>
          </div>

          <Button size="lg" className="usergy-btn-primary group">
            <Rocket className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform duration-300" />
            Launch Your First Project
          </Button>
        </div>

        {/* Quick Stats Preview */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-background/60 backdrop-blur-sm rounded-2xl p-6 border border-border/40">
            <div className="text-2xl lg:text-3xl font-bold text-foreground">
              {activeProjects}
            </div>
            <div className="text-sm text-muted-foreground">Active Projects</div>
          </div>
          
          <div className="bg-background/60 backdrop-blur-sm rounded-2xl p-6 border border-border/40">
            <div className="text-2xl lg:text-3xl font-bold text-foreground">
              {totalUsersEngaged}
            </div>
            <div className="text-sm text-muted-foreground">Users Engaged</div>
          </div>
        </div>
      </div>
    </div>
  );
}