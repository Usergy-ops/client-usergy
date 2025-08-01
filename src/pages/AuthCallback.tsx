// src/pages/AuthCallback.tsx (NEW FILE)
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const accountType = localStorage.getItem('pending_account_type') || 'client';
      const sourceUrl = localStorage.getItem('pending_source_url') || window.location.origin;
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user && !user.user_metadata.account_type) {
        await supabase.auth.updateUser({
          data: {
            account_type: accountType,
            source_url: sourceUrl,
          },
        });
      }
      
      localStorage.removeItem('pending_account_type');
      localStorage.removeItem('pending_source_url');
      
      navigate('/dashboard');
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}