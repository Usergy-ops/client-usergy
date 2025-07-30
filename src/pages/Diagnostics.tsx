
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
      <h1 className="text-2xl font-bold mb-4">Enhanced Diagnostics</h1>
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
          <h2 className="text-xl font-semibold">Comprehensive Account Diagnosis</h2>
          {error && <p className="text-red-500 mb-2">Error: {error}</p>}
          <pre className="bg-gray-100 p-2 rounded">
            {JSON.stringify(diagnosis, null, 2)}
          </pre>
          {diagnosis?.issues && diagnosis.issues.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold text-red-600">Issues Found:</h3>
              <ul className="list-disc pl-5">
                {diagnosis.issues.map((issue: string, index: number) => (
                  <li key={index} className="text-red-600">{issue}</li>
                ))}
              </ul>
            </div>
          )}
          {diagnosis?.recommendations && diagnosis.recommendations.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold text-blue-600">Recommendations:</h3>
              <ul className="list-disc pl-5">
                {diagnosis.recommendations.map((recommendation: string, index: number) => (
                  <li key={index} className="text-blue-600">{recommendation}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
