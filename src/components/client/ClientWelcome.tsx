
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function ClientWelcome() {
  const navigate = useNavigate();

  // This component now just redirects to the main Welcome page
  // which handles all auth logic centrally
  useEffect(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  return null;
}
