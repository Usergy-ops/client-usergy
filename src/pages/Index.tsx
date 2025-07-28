
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import Welcome from './Welcome';

const Index = () => {
  const navigate = useNavigate();
  const { user, isClientAccount, loading } = useClientAuth();

  useEffect(() => {
    // Auto-redirect authenticated users to dashboard
    if (!loading && user && isClientAccount) {
      console.log('Index: Authenticated user detected, redirecting to dashboard');
      navigate('/dashboard', { replace: true });
    }
  }, [user, isClientAccount, loading, navigate]);

  // Show Welcome page for non-authenticated users or while loading
  return <Welcome />;
};

export default Index;
