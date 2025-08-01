
// src/pages/Index.tsx
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const { user, accountType, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && accountType) {
      // Clear, deterministic redirect logic
      const redirectUrl = accountType === 'user' 
        ? 'https://user.usergy.ai/profile-completion'
        : 'https://client.usergy.ai/profile';
      
      console.log(`Redirecting ${accountType} to ${redirectUrl}`);
      window.location.href = redirectUrl;
    }
  }, [user, accountType, loading]);

  // ... rest of component
};
