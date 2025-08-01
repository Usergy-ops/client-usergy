import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';

export function ClientAuthTestUtility() {
  const [userId, setUserId] = useState('');
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchSessionInfo = async () => {
    setLoading(true);
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error fetching session:', error);
        setSessionInfo({ error: error.message });
      } else {
        setSessionInfo(session);
      }
    } catch (error: any) {
      console.error('Unexpected error:', error);
      setSessionInfo({ error: error.message || 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-[400px]">
      <CardHeader>
        <CardTitle>Client Auth Test Utility</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="user-id">User ID</Label>
          <Input
            id="user-id"
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Enter user ID"
          />
        </div>

        <Button onClick={fetchSessionInfo} disabled={loading}>
          {loading ? 'Loading...' : 'Fetch Session Info'}
        </Button>

        {sessionInfo && (
          <div className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Session Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sessionInfo.error ? (
                  <p className="text-red-500">Error: {sessionInfo.error}</p>
                ) : (
                  <>
                    <p>
                      <Badge>Access Token:</Badge>{' '}
                      {sessionInfo.access_token ? 'Present' : 'Missing'}
                    </p>
                    <p>
                      <Badge>Refresh Token:</Badge>{' '}
                      {sessionInfo.refresh_token ? 'Present' : 'Missing'}
                    </p>
                    <Separator />
                    <p>
                      <Badge>User ID:</Badge> {sessionInfo.user?.id}
                    </p>
                    <p>
                      <Badge>User Email:</Badge> {sessionInfo.user?.email}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
    >
      {children}
    </label>
  );
}

function Input({ id, type, value, onChange, placeholder }: {
  id: string;
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
}) {
  return (
    <input
      type={type}
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}
