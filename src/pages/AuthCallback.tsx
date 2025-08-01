// src/pages/AuthCallback.tsx (User Project)
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }

        if (session) {
          // Get stored account type info
          const pendingAccountType = localStorage.getItem('pending_account_type');
          const pendingSourceUrl = localStorage.getItem('pending_source_url');
          
          // Clean up
          localStorage.removeItem('pending_account_type');
          localStorage.removeItem('pending_source_url');
          
          // Update user metadata with account type
          if (pendingAccountType) {
            await supabase.auth.updateUser({
              data: {
                account_type: pendingAccountType,
                source_domain: pendingSourceUrl
              }
            });
          }
          
          // Redirect based on account type
          if (pendingAccountType === 'user') {
            window.location.href = 'https://user.usergy.ai/profile-completion';
          } else {
            window.location.href = 'https://client.usergy.ai/profile';
          }
        } else {
          navigate('/');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        toast({
          title: "Authentication Error",
          description: "Something went wrong. Please try again.",
          variant: "destructive"
        });
        navigate('/');
      }
    };

    handleCallback();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-lg">Completing authentication...</p>
      </div>
    </div>
  );
};

export default AuthCallback;