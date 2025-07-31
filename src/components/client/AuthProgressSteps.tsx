
import React from 'react';
import { CheckCircle, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuthProgressStepsProps {
  currentStep: 'verification' | 'account-creation' | 'workspace-setup' | 'complete';
  className?: string;
}

const steps = [
  { id: 'verification', label: 'Email Verification', description: 'Verify your email address' },
  { id: 'account-creation', label: 'Account Creation', description: 'Setting up your account' },
  { id: 'workspace-setup', label: 'Workspace Setup', description: 'Preparing your dashboard' },
  { id: 'complete', label: 'Complete', description: 'Ready to use Usergy' }
];

export function AuthProgressSteps({ currentStep, className }: AuthProgressStepsProps) {
  const getCurrentStepIndex = () => {
    return steps.findIndex(step => step.id === currentStep);
  };

  const currentStepIndex = getCurrentStepIndex();

  const getStepStatus = (stepIndex: number) => {
    if (stepIndex < currentStepIndex) return 'completed';
    if (stepIndex === currentStepIndex) return 'current';
    return 'pending';
  };

  return (
    <div className={cn("w-full max-w-2xl", className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const status = getStepStatus(index);
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center text-center min-w-0 flex-1">
                <div className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full border-2 mb-2 transition-colors",
                  status === 'completed' && "bg-green-500 border-green-500 text-white",
                  status === 'current' && "border-primary bg-primary text-white",
                  status === 'pending' && "border-muted bg-background text-muted-foreground"
                )}>
                  {status === 'completed' && <CheckCircle className="h-5 w-5" />}
                  {status === 'current' && <Loader2 className="h-5 w-5 animate-spin" />}
                  {status === 'pending' && <Circle className="h-5 w-5" />}
                </div>
                
                <div className="space-y-1">
                  <p className={cn(
                    "text-sm font-medium",
                    status === 'completed' && "text-green-600",
                    status === 'current' && "text-primary",
                    status === 'pending' && "text-muted-foreground"
                  )}>
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    {step.description}
                  </p>
                </div>
              </div>
              
              {!isLast && (
                <div className={cn(
                  "flex-1 h-0.5 mx-4 transition-colors",
                  index < currentStepIndex ? "bg-green-500" : "bg-muted"
                )} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
