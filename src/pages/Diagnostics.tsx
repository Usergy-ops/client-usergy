import { useState, useEffect } from 'react';
import { useClientAuth } from '@/contexts/ClientAuthContext';

export default function Diagnostics() {
  const { user, session, loading, isClientAccount, diagnoseAccount } = useClientAuth();
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      diagnoseAccount(user.id)
        .then(setDiagnosis)
        .catch(err => setError(err.message));
    }
  }, [user, diagnoseAccount]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Diagnostics</h1>
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Auth Context State</h2>
          <pre className="bg-gray-100 p-2 rounded">
            {JSON.stringify({
              loading,
              isClientAccount,
              user: user ? { id: user.id, email: user.email } : null,
              session: session ? { access_token: '...', expires_in: session.expires_in } : null,
            }, null, 2)}
          </pre>
        </div>
        <div>
          <h2 className="text-xl font-semibold">Database Account Diagnosis</h2>
          {error && <p className="text-red-500">{error}</p>}
          <pre className="bg-gray-100 p-2 rounded">
            {JSON.stringify(diagnosis, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
