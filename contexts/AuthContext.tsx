'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { useSupabase } from '@/hooks/useSupabase';
import { SupabaseClient } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  supabase: SupabaseClient;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  checkAuthStatus: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = useSupabase();

  // Initialize user session from Supabase
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);

        // Get session from Supabase
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (session) {
          setSession(session);
          setUser(session.user);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setError(error instanceof Error ? error.message : 'Authentication failed');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Set up auth state change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[AuthContext] Auth state changed, updating context');
      setSession(session);
      setUser(session?.user ?? null);
    });

    // Clean up subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Sign in with email and password
  const signInWithEmail = async (email: string, password: string) => {
    try {
      setError(null);
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error signing in with email:', error);
      setError(error instanceof Error ? error.message : 'Sign in failed');
      throw error;
    }
  };

  // Sign up with email and password
  const signUpWithEmail = async (email: string, password: string) => {
    try {
      setError(null);
      const { error } = await supabase.auth.signUp({ email, password });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error signing up with email:', error);
      setError(error instanceof Error ? error.message : 'Sign up failed');
      throw error;
    }
  };

  // Sign in with Google
  const signInWithGoogle = async (): Promise<void> => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        console.error('[Auth] Error signing in with Google:', error);
        setError(error instanceof Error ? error.message : 'Google sign-in failed');
        throw error;
      }
    } catch (error) {
      console.error('[Auth] Error signing in with Google:', error);
      setError(error instanceof Error ? error.message : 'Google sign-in failed');
      throw error;
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      setError(null);
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      // Clear user and session state
      setUser(null);
      setSession(null);

      // Redirect to login page after signing out
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
      setError(error instanceof Error ? error.message : 'Sign out failed');
      throw error;
    }
  };

  // Check auth status via API for server-client synchronization
  const checkAuthStatus = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/verify-auth', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      return data.authenticated === true;
    } catch (error) {
      console.error('Error checking auth status:', error);
      return false;
    }
  };

  const value = {
    user,
    session,
    isLoading,
    error,
    supabase,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
    checkAuthStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook for using auth context
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
