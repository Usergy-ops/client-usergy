
import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface SimpleAuthFeedback {
  showSuccess: (title: string, description?: string) => void;
  showError: (title: string, description?: string) => void;
  showInfo: (title: string, description?: string) => void;
}

export function useSimpleAuthFeedback(): SimpleAuthFeedback {
  const { toast } = useToast();

  const showSuccess = useCallback((title: string, description?: string) => {
    toast({
      title,
      description,
      variant: "default",
    });
  }, [toast]);

  const showError = useCallback((title: string, description?: string) => {
    toast({
      title,
      description,
      variant: "destructive",
    });
  }, [toast]);

  const showInfo = useCallback((title: string, description?: string) => {
    toast({
      title,
      description,
      variant: "default",
    });
  }, [toast]);

  return {
    showSuccess,
    showError,
    showInfo
  };
}
