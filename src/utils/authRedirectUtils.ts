
/**
 * Centralized authentication redirect utilities
 * Provides consistent redirect behavior across all auth components
 */

const getBaseUrl = () => {
  return window.location.origin;
};

/**
 * Redirects to dashboard
 */
export function redirectToDashboard(): void {
  console.log('Redirecting to dashboard');
  const baseUrl = getBaseUrl();
  window.location.href = `${baseUrl}/dashboard`;
}

/**
 * Redirects to welcome page with sign-in mode
 */
export function redirectToSignIn(): void {
  console.log('Redirecting to sign in');
  const baseUrl = getBaseUrl();
  window.location.href = `${baseUrl}/?signin=true`;
}

/**
 * Redirects to user portal for non-client accounts
 */
export function redirectToUserPortal(): void {
  console.log('Redirecting to user portal');
  // Only use external URL for production
  if (window.location.hostname === 'client.usergy.ai') {
    window.location.href = 'https://user.usergy.ai';
  } else {
    // In development, just go to home
    window.location.href = '/';
  }
}

/**
 * Redirects to auth callback page
 */
export function redirectToAuthCallback(): void {
  console.log('Redirecting to auth callback');
  const baseUrl = getBaseUrl();
  window.location.href = `${baseUrl}/auth/callback`;
}

/**
 * Logs redirect information for debugging
 */
export function logRedirect(context: string, destination: string, userInfo?: any): void {
  console.log(`[AUTH REDIRECT] ${context} -> ${destination}`, userInfo);
}

/**
 * Determines the appropriate redirect based on user state
 */
export function getRedirectPath(user: any, isClientAccount: boolean): string {
  if (!user) return '/';
  if (isClientAccount) return '/dashboard';
  return '/';
}
