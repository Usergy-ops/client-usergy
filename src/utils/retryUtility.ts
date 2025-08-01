
interface RetryOptions {
  maxRetries?: number;
  delay?: number;
  backoff?: boolean;
}

export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, delay = 1000, backoff = true } = options;
  
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const waitTime = backoff ? delay * Math.pow(2, attempt - 1) : delay;
      console.log(`Operation failed (attempt ${attempt}/${maxRetries}), retrying in ${waitTime}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError!;
}

export function isRetryableError(error: any): boolean {
  // Network errors
  if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('Network')) {
    return true;
  }
  
  // Temporary server errors
  if (error?.status >= 500 && error?.status < 600) {
    return true;
  }
  
  // Rate limiting
  if (error?.status === 429) {
    return true;
  }
  
  // Supabase function timeouts
  if (error?.message?.includes('timeout') || error?.message?.includes('TimeoutError')) {
    return true;
  }
  
  return false;
}
