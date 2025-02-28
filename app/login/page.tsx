'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { LoginForm } from '@/components/LoginForm';

export default function LoginPage() {
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail, supabase } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Handle OAuth redirect with token in URL fragment
    const handleTokenInUrl = async () => {
      // Check if we have a hash in the URL
      if (typeof window !== 'undefined' && window.location.hash) {
        setIsLoading(true);
        console.log('Found hash in URL:', window.location.hash);
        
        // Extract the access token and other parameters from the URL fragment
        const hashParams = new URLSearchParams(
          window.location.hash.substring(1) // Remove the # character
        );
        
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const expiresIn = hashParams.get('expires_in');
        const tokenType = hashParams.get('token_type');
        
        console.log('Extracted tokens:', { 
          accessToken: accessToken ? `${accessToken.substring(0, 10)}...` : null,
          refreshToken: refreshToken ? 'present' : null,
          expiresIn,
          tokenType
        });
        
        if (accessToken && refreshToken) {
          console.log('Found valid tokens in URL, attempting to set session');
          
          try {
            // Set the session with the extracted tokens
            console.log('Calling supabase.auth.setSession...');
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (error) {
              console.error('Error setting session:', error);
              setError('Failed to authenticate: ' + error.message);
            } else {
              console.log('Session response:', { 
                user: data?.user ? 'present' : null,
                session: data?.session ? 'present' : null
              });
              
              if (data?.user) {
                console.log('Session established successfully, redirecting to dashboard');
                // Clear the hash from the URL to prevent token exposure
                window.history.replaceState(null, '', window.location.pathname);
                router.replace('/dashboard');
                return;
              } else {
                console.error('No user returned after setting session');
                setError('Authentication failed: No user returned');
              }
            }
          } catch (err) {
            console.error('Exception during authentication:', err);
            setError('Authentication failed: ' + (err instanceof Error ? err.message : String(err)));
          }
        } else {
          console.error('Missing required tokens in URL fragment');
          setError('Authentication failed: Missing required tokens');
        }
        
        setIsLoading(false);
      } else {
        console.log('No hash found in URL, skipping token processing');
      }
    };

    // First check for tokens in URL
    handleTokenInUrl();
    
    // Then check if user is already logged in
    if (user) {
      console.log('User already logged in, redirecting to dashboard');
      router.replace('/dashboard');
    } else {
      setIsLoading(false);
    }
  }, [user, router, supabase.auth]);

  const handleSubmit = async (email: string, password: string, isSignUp: boolean) => {
    setError('');
    setIsLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await signUpWithEmail(email, password);
        if (error) throw error;
        
        // Check if the user needs to verify their email
        if (data?.user && !data.user.email_confirmed_at) {
          router.replace(`/verify-email?email=${encodeURIComponent(email)}`);
          return;
        }
        
        router.replace('/dashboard');
      } else {
        await signInWithEmail(email, password);
        router.replace('/dashboard');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex mt-20 justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* <h1 className="text-4xl font-bold text-center mb-8 text-primary dark:text-white">
          NextTemp
        </h1> */}
        <LoginForm
          onSubmit={handleSubmit}
          onGoogleSignIn={signInWithGoogle}
          isLoading={isLoading}
          error={error}
        />
      </div>
    </div>
  );
} 