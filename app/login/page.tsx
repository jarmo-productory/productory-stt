'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabase } from '@/hooks/useSupabase';
import { useSearchParams } from 'next/navigation';
import { LoginForm } from '@/components/LoginForm';
import { Loader2 } from 'lucide-react';

// CRITICAL FIX: Loop detection
const LOOP_THRESHOLD = 3;
const STORAGE_KEY = 'auth_redirect_count';

/**
 * LoginContent component that uses useSearchParams
 * This is wrapped in Suspense to handle useSearchParams
 */
function LoginContent() {
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const supabase = useSupabase();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect');
  const authComplete = searchParams.get('auth_complete');
  const nextPath = searchParams.get('next');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true); // Start with loading true
  const [isInRedirectLoop, setIsInRedirectLoop] = useState(false);

  // CRITICAL FIX: Detect and break redirect loops
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    // Check if we're potentially in a redirect loop
    if (redirectPath === '/dashboard') {
      try {
        // Get current redirect count
        const currentCount = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);

        // If we've redirected too many times, assume we're in a loop
        if (currentCount >= LOOP_THRESHOLD) {
          console.error('LOOP DETECTED: Breaking redirect loop with emergency reset');
          setIsInRedirectLoop(true);

          // Clear any auth state that might be causing issues
          localStorage.removeItem(STORAGE_KEY);

          // Attempt to clear session-related cookies
          document.cookie.split(';').forEach(cookie => {
            const [name] = cookie.trim().split('=');
            if (name.includes('supabase') || name.includes('auth')) {
              document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
            }
          });

          // Don't continue with any redirects
          return;
        }

        // Increment the counter
        localStorage.setItem(STORAGE_KEY, (currentCount + 1).toString());

        // Set a timeout to clear the counter (prevents false positives)
        setTimeout(() => localStorage.removeItem(STORAGE_KEY), 10000);
      } catch (e) {
        // If there's any storage error, just ignore it
        console.error('Error accessing localStorage:', e);
      }
    } else {
      // If we're not redirecting to dashboard, clear the counter
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [redirectPath]);

  // Enhanced token processing
  const processTokensInUrl = useCallback(async () => {
    // Only run on client side
    if (typeof window === 'undefined') {
      return false;
    }

    // Check if we have a hash in the URL
    if (window.location.hash) {
      console.log('Login: Found hash in URL');

      try {
        // Extract the access token and other parameters from the URL fragment
        const hashParams = new URLSearchParams(
          window.location.hash.substring(1) // Remove the # character
        );

        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (!accessToken || !refreshToken) {
          console.error('Login: Missing required tokens in URL fragment');
          return false;
        }

        console.log('Login: Found valid tokens in URL, attempting to set session');

        // Set the session with the extracted tokens
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error('Login: Error setting session:', error);
          setError('Failed to authenticate: ' + error.message);
          return false;
        }

        if (data?.user) {
          console.log('Login: Session established successfully');

          // Clear the hash from the URL to prevent token exposure
          window.history.replaceState(null, '', window.location.pathname + window.location.search);

          // Increase waiting time in case of previous issues
          console.log('Login: Waiting for session synchronization...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log('Login: Session synchronization complete, proceeding with redirect');

          // Reset loop counter since we have a successful auth
          localStorage.removeItem(STORAGE_KEY);

          return true;
        } else {
          console.error('Login: No user returned after setting session');
          setError('Authentication failed: No user returned');
        }
      } catch (err) {
        console.error('Login: Exception during token processing:', err);
        setError('Authentication failed: ' + (err instanceof Error ? err.message : String(err)));
      }
    } else {
      console.log('Login: No hash found in URL');
    }

    return false;
  }, [supabase.auth, setError]);

  useEffect(() => {
    let isMounted = true;

    const handleAuth = async () => {
      try {
        // If we've detected a redirect loop, don't proceed with automatic redirects
        if (isInRedirectLoop) {
          setIsLoading(false);
          return;
        }

        // HANDLE AUTH_COMPLETE PARAMETER: This means we came from the OAuth callback
        if (authComplete === 'true') {
          console.log('Login: Auth complete parameter detected');

          // Check if we have a session
          const { data } = await supabase.auth.getSession();
          if (data?.session) {
            console.log('Login: Session found after auth_complete redirect');

            // Clean URL parameters
            const destinationPath = nextPath || redirectPath || '/dashboard';
            console.log(`Login: Redirecting to ${destinationPath} after successful auth`);

            // Remove all URL params to break potential redirect loops
            window.history.replaceState(null, '', window.location.pathname);

            // Reset loop counter since we have a successful auth
            localStorage.removeItem(STORAGE_KEY);

            // Use direct navigation to target - important for breaking redirect loops
            window.location.href = destinationPath;
            return;
          } else {
            console.error('Login: No session found after auth_complete redirect');
            if (isMounted) {
              setError('Authentication failed: Session not found');
              setIsLoading(false);
            }
            return;
          }
        }

        // First check for tokens in URL if not already handling auth_complete
        const tokensProcessed = await processTokensInUrl();

        // If we've already processed tokens successfully or we have a user, redirect
        if ((tokensProcessed || user) && isMounted) {
          console.log('Login: User authenticated, redirecting');
          const destination = redirectPath || '/dashboard';

          // Reset loop counter since we have a successful auth
          localStorage.removeItem(STORAGE_KEY);

          // Use window.location for hard navigation
          window.location.href = destination;
          return;
        }
      } finally {
        // Always update loading state at the end
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    handleAuth();

    return () => {
      isMounted = false;
    };
  }, [
    user,
    processTokensInUrl,
    redirectPath,
    authComplete,
    nextPath,
    supabase.auth,
    isInRedirectLoop,
  ]);

  // CRITICAL FIX: Display a special message when a redirect loop is detected
  if (isInRedirectLoop) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md p-6 bg-red-50 rounded-lg border border-red-200">
          <h2 className="text-xl font-semibold mb-4 text-red-800">Authentication Loop Detected</h2>
          <p className="mb-4 text-gray-800">
            We've detected a redirect loop in the authentication process. This has been temporarily
            fixed.
          </p>
          <p className="mb-6 text-gray-600">Please try signing in again using the form below.</p>
          <button
            onClick={() => {
              // Perform a hard refresh to clear any pending state
              window.location.href = '/login';
            }}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reset & Try Again
          </button>
        </div>
      </div>
    );
  }

  // Don't render login form during auth_complete
  if (authComplete === 'true' && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Completing authentication...</h2>
          <p className="text-gray-600">You'll be redirected in a moment</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (email: string, password: string, isSignUp: boolean) => {
    setError('');
    setIsLoading(true);

    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Google sign in error:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <LoginForm
        onSubmit={handleSubmit}
        onGoogleSignIn={handleGoogleSignIn}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
}

/**
 * LoginPage
 *
 * Main login page component that wraps the content in a Suspense boundary
 * to handle useSearchParams() hook
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Loading...</h2>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
