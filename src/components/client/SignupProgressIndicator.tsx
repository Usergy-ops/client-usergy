
import React from 'react';
import { CheckCircle, Clock, AlertCircle, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SignupProgressIndicatorProps {
  status: 'idle' | 'creating' | 'sending-email' | 'success' | 'error';
  message?: string;
  className?: string;
}

export function SignupProgressIndicator({ status, message, className }: SignupProgressIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'creating':
        return {
          icon: Clock,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          label: 'Creating your account...'
        };
      case 'sending-email':
        return {
          icon: Mail,
          color: 'text-amber-600',
          bgColor: 'bg-amber-50',
          label: 'Sending verification email...'
        };
      case 'success':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          label: 'Account created successfully!'
        };
      case 'error':
        return {
          icon: AlertCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          label: 'Account creation failed'
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  
  if (!config || status === 'idle') {
    return null;
  }

  const Icon = config.icon;
  const isAnimated = status === 'creating' || status === 'sending-email';

  return (
    <div className={cn(
      "flex items-center space-x-3 p-4 rounded-lg border animate-in slide-in-from-top-2",
      config.bgColor,
      className
    )}>
      <Icon 
        className={cn(
          "h-5 w-5",
          config.color,
          isAnimated && "animate-pulse"
        )} 
      />
      <div className="flex-1">
        <p className={cn("font-medium text-sm", config.color)}>
          {message || config.label}
        </p>
        {status === 'success' && (
          <p className="text-xs text-muted-foreground mt-1">
            Please check your email for the verification code.
          </p>
        )}
      </div>
    </div>
  );
}
