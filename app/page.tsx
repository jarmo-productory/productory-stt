"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from '@/components/LoginForm';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const HomePage = () => {
  const router = useRouter();
  const { user, signOut, signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Handle form submission for email auth
  const handleSubmit = async (email: string, password: string, isSignUp: boolean) => {
    setAuthError('');
    setIsSubmitting(true);
    
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      
      // After successful login, go to auth sync page to ensure session is established
      window.location.href = '/auth/sync?destination=/dashboard';
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle Google sign in
  const handleGoogleSignIn = async () => {
    setAuthError('');
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
      // Redirects are handled by the OAuth flow via the callback route
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Google authentication failed');
      setIsSubmitting(false);
    }
  };
  
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        setLoading(true);
        
        if (user) {
          console.log('[HomePage] User detected, redirecting to auth sync page');
          
          // Use auth sync page to ensure session is properly established
          window.location.href = '/auth/sync?destination=/dashboard';
          return;
        }
      } catch (error) {
        console.error('[HomePage] Auth check error:', error);
      } finally {
        setLoading(false);
      }
    };
    
    // Only verify auth when the component mounts
    verifyAuth();
  }, [user]);
  
  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="w-12 h-12 rounded-full border-2 border-t-blue-500 animate-spin mb-4"></div>
        <p className="text-gray-600">Checking authentication status...</p>
      </div>
    );
  }
  
  // When user is null (not authenticated), show login form
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <LoginForm 
          onSubmit={handleSubmit}
          onGoogleSignIn={handleGoogleSignIn}
          isLoading={isSubmitting}
          error={authError}
        />
      </div>
    </div>
  );
};

export default HomePage;

