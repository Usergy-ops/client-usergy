// src/pages/Index.tsx
import { useEffect } from 'react';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const { user, isClientAccount, loading } = useClientAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && isClientAccount) {
      // Clear, deterministic redirect logic
      const redirectUrl = 'https://client.usergy.ai/profile';
      
      console.log(`Redirecting client to ${redirectUrl}`);
      window.location.href = redirectUrl;
    }
  }, [user, isClientAccount, loading]);

  // ... rest of component
};

export default Index;
