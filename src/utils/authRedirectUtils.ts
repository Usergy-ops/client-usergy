/**
 * Centralized authentication redirect utilities
 * Provides consistent redirect behavior across all auth components
 */

const PRODUCTION_URL = 'https://client.usergy.ai';

/**
 * Redirects to dashboard with absolute URL
 * Uses window.location.href for full page reload to ensure clean state
 */
export function redirectToDashboard(): void {
  console.log('Redirecting to dashboard');
  window.location.href = `${PRODUCTION_URL}/dashboard`;
}

/**
 * Redirects to welcome page with sign-in mode
 */
export function redirectToSignIn(): void {
  console.log('Redirecting to sign in');
  window.location.href = `${PRODUCTION_URL}/?signin=true`;
}

/**
 * Redirects to user portal for non-client accounts
 */
export function redirectToUserPortal(): void {
  console.log('Redirecting to user portal');
  window.location.href = 'https://user.usergy.ai';
}

/**
 * Redirects to profile setup
 */
export function redirectToProfile(): void {
  console.log('Redirecting to profile setup');
  window.location.href = `${PRODUCTION_URL}/profile`;
}

/**
 * Logs redirect information for debugging
 */
export function logRedirect(context: string, destination: string, userInfo?: any): void {
  console.log(`[AUTH REDIRECT] ${context} -> ${destination}`, userInfo);
}