
import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

interface EnhancedAuthFeedback {
  showFeedback: (type: 'success' | 'error' | 'info' | 'warning', title: string, description?: string, diagnostic?: any) => void;
  showProcessingFeedback: (message: string) => void;
  showRetryableFeedback: (title: string, description: string, onRetry: () => void) => void;
  hideFeedback: () => void;
  isShowing: boolean;
}

export function useEnhancedAuthFeedback(): EnhancedAuthFeedback {
  const [isShowing, setIsShowing] = useState(false);
  const { toast } = useToast();

  const showFeedback = useCallback((
    type: 'success' | 'error' | 'info' | 'warning', 
    title: string, 
    description?: string,
    diagnostic?: any
  ) => {
    setIsShowing(true);
    
    // Enhanced description with diagnostic info if available
    let enhancedDescription = description;
    if (diagnostic && process.env.NODE_ENV === 'development') {
      enhancedDescription += '\n\nDiagnostic data available in console.';
      console.log('Enhanced Auth Diagnostic:', diagnostic);
    }
    
    toast({
      title,
      description: enhancedDescription,
      variant: type === 'error' ? 'destructive' : 'default',
    });

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

  const showRetryableFeedback = useCallback((
    title: string, 
    description: string, 
    onRetry: () => void
  ) => {
    setIsShowing(true);
    
    toast({
      title,
      description,
      variant: 'destructive',
      action: (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      ),
    });
  }, [toast]);

  const hideFeedback = useCallback(() => {
    setIsShowing(false);
  }, []);

  return {
    showFeedback,
    showProcessingFeedback,
    showRetryableFeedback,
    hideFeedback,
    isShowing
  };
}
