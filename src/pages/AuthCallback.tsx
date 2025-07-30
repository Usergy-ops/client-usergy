
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { NetworkNodes } from '@/components/client/NetworkNodes';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { AuthStatusIndicator } from '@/components/client/AuthStatusIndicator';
import { AuthProgressSteps } from '@/components/client/AuthProgressSteps';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { session, loading, waitForClientAccount, diagnoseAccount } = useClientAuth();
  const processedRef = useRef(false);
  const [status, setStatus] = useState<'checking' | 'creating' | 'success' | 'error'>('checking');
  const [statusMessage, setStatusMessage] = useState('Checking your authentication...');
  const [authStep, setAuthStep] = useState<'verification' | 'account-creation' | 'workspace-setup' | 'complete'>('account-creation');

  useEffect(() => {
    if (processedRef.current || loading) {
      return;
    }

    const handleCallback = async () => {
      if (!session?.user?.id) {
        console.log('AuthCallback: No user session found, redirecting to home');
        setStatus('error');
        setStatusMessage('No user session found');
        setTimeout(() => navigate('/', { replace: true }), 2000);
        return;
      }

      processedRef.current = true;
      const userId = session.user.id;
      console.log(`AuthCallback: Processing for user ${userId}`);

      try {
        setStatus('creating');
        setAuthStep('account-creation');
        setStatusMessage('Setting up your account...');

        // Give the database trigger some time to process the new user
        console.log('AuthCallback: Waiting for database trigger processing...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        setAuthStep('workspace-setup');
        setStatusMessage('Preparing your workspace...');

        // Wait for client account creation with more attempts
        const isClient = await waitForClientAccount(userId, 15);
        
        if (isClient) {
          console.log('AuthCallback: Client account confirmed, redirecting to dashboard');
          setAuthStep('complete');
          setStatus('success');
          setStatusMessage('Account ready! Redirecting to dashboard...');
          
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 1500);
        } else {
          // Diagnose what went wrong
          const diagnosis = await diagnoseAccount(userId);
          console.log('AuthCallback: Account diagnosis result:', diagnosis);
          
          if (diagnosis.user_exists && diagnosis.account_type_exists) {
            console.log('AuthCallback: User and account type exist but not client, redirecting to profile setup');
            setStatus('error');
            setStatusMessage('Account setup incomplete, redirecting to profile setup...');
            setTimeout(() => navigate('/profile', { replace: true }), 2000);
          } else {
            console.log('AuthCallback: Account setup incomplete, redirecting to home');
            setStatus('error');
            setStatusMessage('Account setup failed, please try again...');
            setTimeout(() => navigate('/', { replace: true }), 3000);
          }
        }
      } catch (error) {
        console.error('AuthCallback: Error during processing, redirecting to home', error);
        setStatus('error');
        setStatusMessage('An error occurred during account setup');
        setTimeout(() => navigate('/', { replace: true }), 3000);
      }
    };

    handleCallback();
  }, [session, loading, navigate, waitForClientAccount, diagnoseAccount]);

  return (
    <div className="min-h-screen relative flex items-center justify-center">
      <NetworkNodes />
      <div className="glass-card p-8 text-center relative z-10 max-w-2xl mx-4">
        <div className="space-y-8">
          {/* Progress Steps */}
          <AuthProgressSteps currentStep={authStep} />
          
          {/* Status Indicator */}
          <AuthStatusIndicator 
            status={status} 
            message={statusMessage}
          />
          
          {/* Additional Information */}
          <div className="space-y-2">
            <p className="text-lg font-semibold text-foreground">Setting up your Usergy account</p>
            <p className="text-sm text-muted-foreground">
              {status === 'checking' && 'Verifying your authentication status...'}
              {status === 'creating' && 'This usually takes less than 30 seconds'}
              {status === 'success' && 'Welcome to Usergy! Taking you to your dashboard...'}
              {status === 'error' && 'We encountered an issue, but we\'ll get you sorted out'}
            </p>
          </div>

          {status === 'creating' && (
            <div className="bg-muted/20 rounded-lg p-4 text-xs text-muted-foreground">
              <p>💡 <strong>Tip:</strong> Keep this window open while we set up your account</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
