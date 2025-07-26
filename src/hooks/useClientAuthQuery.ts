
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { supabase } from '@/lib/supabase';
import { checkClientSignInRateLimit, recordClientSignInAttempt } from '@/utils/clientAuthUtils';

export const useClientAuthQuery = () => {
  const { user, session } = useClientAuth();
  const queryClient = useQueryClient();

  // Query for client account verification
  const {
    data: clientVerification,
    isLoading: isVerifyingClient,
    error: clientError
  } = useQuery({
    queryKey: ['client-verification', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('account_types')
        .select('account_type')
        .eq('auth_user_id', user.id)
        .eq('account_type', 'client')
        .single();
        
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Query for rate limit status
  const useRateLimitQuery = (identifier: string) => {
    return useQuery({
      queryKey: ['rate-limit', identifier],
      queryFn: () => checkClientSignInRateLimit(identifier),
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 60 * 1000, // 1 minute
      enabled: !!identifier,
    });
  };

  // Mutation for enhanced sign in with rate limiting
  const signInMutation = useMutation({
    mutationFn: async ({ 
      email, 
      password 
    }: { 
      email: string; 
      password: string; 
    }) => {
      const identifier = `signin_${email}`;
      
      // Check rate limit first
      const rateLimitCheck = await checkClientSignInRateLimit(identifier);
      if (!rateLimitCheck.isAllowed) {
        throw new Error('Too many failed attempts. Please try again later.');
      }

      // Attempt sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      // Record the attempt
      await recordClientSignInAttempt(identifier, !error);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate relevant queries on successful sign in
      queryClient.invalidateQueries({ queryKey: ['client-verification'] });
    },
  });

  return {
    user,
    session,
    clientVerification,
    isVerifyingClient,
    clientError,
    signInMutation,
    useRateLimitQuery,
  };
};
