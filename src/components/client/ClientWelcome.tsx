
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientAuth } from '@/contexts/ClientAuthContext';

export function ClientWelcome() {
  const navigate = useNavigate();
  const { user, isClientAccount, loading } = useClientAuth();

  useEffect(() => {
    // Auto-redirect authenticated users to dashboard
    if (!loading && user && isClientAccount) {
      console.log('ClientWelcome: Authenticated user detected, redirecting to dashboard');
      navigate('/dashboard', { replace: true });
    }
  }, [user, isClientAccount, loading, navigate]);

  // Redirect to the main Welcome page which handles all auth logic
  useEffect(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  return null;
}
