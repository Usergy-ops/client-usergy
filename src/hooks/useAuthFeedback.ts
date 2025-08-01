
import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface AuthFeedback {
  showFeedback: (type: 'success' | 'error' | 'info' | 'warning', title: string, description?: string) => void;
  showProcessingFeedback: (message: string) => void;
  hideFeedback: () => void;
  isShowing: boolean;
}

export function useAuthFeedback(): AuthFeedback {
  const [isShowing, setIsShowing] = useState(false);
  const { toast } = useToast();

  const showFeedback = useCallback((
    type: 'success' | 'error' | 'info' | 'warning', 
    title: string, 
    description?: string
  ) => {
    setIsShowing(true);
    
    toast({
      title,
      description,
      variant: type === 'error' ? 'destructive' : 'default',
    });

    // Auto-hide after showing
    setTimeout(() => {
      setIsShowing(false);
    }, 100);
  }, [toast]);

  const showProcessingFeedback = useCallback((message: string) => {
    setIsShowing(true);
    toast({
      title: "Processing...",
      description: message,
    });
  }, [toast]);

  const hideFeedback = useCallback(() => {
    setIsShowing(false);
  }, []);

  return {
    showFeedback,
    showProcessingFeedback,
    hideFeedback,
    isShowing
  };
}
