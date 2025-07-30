
import React from 'react';
import { CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuthStatusIndicatorProps {
  status: 'checking' | 'creating' | 'success' | 'error' | 'waiting';
  message?: string;
  className?: string;
}

export function AuthStatusIndicator({ status, message, className }: AuthStatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'checking':
        return {
          icon: RefreshCw,
          color: 'text-primary',
          bgColor: 'bg-primary/10',
          label: 'Checking account status...'
        };
      case 'creating':
        return {
          icon: Clock,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          label: 'Creating your account...'
        };
      case 'waiting':
        return {
          icon: Clock,
          color: 'text-amber-600',
          bgColor: 'bg-amber-50',
          label: 'Setting up your workspace...'
        };
      case 'success':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          label: 'Account ready!'
        };
      case 'error':
        return {
          icon: AlertCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          label: 'Account setup failed'
        };
      default:
        return {
          icon: Clock,
          color: 'text-muted-foreground',
          bgColor: 'bg-muted',
          label: 'Processing...'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  const isAnimated = status === 'checking' || status === 'creating' || status === 'waiting';

  return (
    <div className={cn(
      "flex items-center space-x-3 p-4 rounded-lg border",
      config.bgColor,
      className
    )}>
      <Icon 
        className={cn(
          "h-5 w-5",
          config.color,
          isAnimated && "animate-spin"
        )} 
      />
      <div className="flex-1">
        <p className={cn("font-medium", config.color)}>
          {message || config.label}
        </p>
        {status === 'waiting' && (
          <p className="text-xs text-muted-foreground mt-1">
            This usually takes a few seconds...
          </p>
        )}
      </div>
    </div>
  );
}
