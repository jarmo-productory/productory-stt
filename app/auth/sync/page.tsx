'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const MAX_ATTEMPTS = 20; // Maximum verification attempts
const VERIFY_INTERVAL = 300; // Time between verification attempts in ms

/**
 * Auth Sync Page
 * 
 * This page serves as a synchronization point between server and client auth state.
 * It repeatedly verifies authentication status before redirecting to the destination.
 * This helps prevent redirect loops caused by client/server auth state mismatch.
 */
export default function AuthSyncPage() {
  const searchParams = useSearchParams();
  const destination = searchParams.get('destination') || '/dashboard';
  const [attempts, setAttempts] = useState(0);
  const [status, setStatus] = useState<'verifying'|'success'|'failed'>('verifying');
  const [message, setMessage] = useState('Synchronizing authentication state...');
  
  useEffect(() => {
    // Clear any redirect tracking counters to prevent false positives
    localStorage.removeItem('redirectCount');
    
    let isMounted = true;
    let attemptCount = 0;
    let timerId: NodeJS.Timeout;
    
    const verifyAuth = async () => {
      if (!isMounted) return;
      
      try {
        attemptCount++;
        console.log(`[Auth Sync] Verification attempt ${attemptCount}/${MAX_ATTEMPTS}`);
        
        // Call the verify-auth endpoint to check auth status
        const response = await fetch('/api/verify-auth', {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache, no-store',
            'Pragma': 'no-cache'
          }
        });
        
        if (!isMounted) return;
        
        if (response.ok) {
          // Auth verified successfully
          const data = await response.json();
          console.log('[Auth Sync] Authentication verified successfully', data);
          
          setStatus('success');
          setMessage(`Authentication confirmed! Redirecting to ${destination}...`);
          
          // Small delay before redirect to ensure UI updates
          setTimeout(() => {
            if (isMounted) {
              window.location.href = destination;
            }
          }, 500);
          
          return;
        }
        
        // If we've reached max attempts, give up
        if (attemptCount >= MAX_ATTEMPTS) {
          console.error('[Auth Sync] Max verification attempts reached');
          setStatus('failed');
          setMessage('Authentication verification timed out. Please try logging in again.');
          return;
        }
        
        // Update UI with current attempt
        setAttempts(attemptCount);
        
        // Schedule next attempt
        timerId = setTimeout(verifyAuth, VERIFY_INTERVAL);
      } catch (error) {
        console.error('[Auth Sync] Error verifying authentication:', error);
        
        if (!isMounted) return;
        
        // If we've reached max attempts, give up
        if (attemptCount >= MAX_ATTEMPTS) {
          setStatus('failed');
          setMessage('Error verifying authentication. Please try logging in again.');
          return;
        }
        
        // Schedule next attempt
        timerId = setTimeout(verifyAuth, VERIFY_INTERVAL);
      }
    };
    
    // Start verification process
    verifyAuth();
    
    // Cleanup function
    return () => {
      isMounted = false;
      clearTimeout(timerId);
    };
  }, [destination]);
  
  // Render different UI based on current status
  if (status === 'verifying') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
        <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-md">
          <div className="flex flex-col items-center text-center">
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
            <h1 className="text-2xl font-semibold text-gray-800">Completing Authentication</h1>
            <p className="mt-2 text-gray-600">{message}</p>
            
            <div className="w-full mt-6 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                style={{width: `${Math.min(100, (attempts / MAX_ATTEMPTS) * 100)}%`}}
              ></div>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Attempt {attempts}/{MAX_ATTEMPTS}
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  if (status === 'success') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
        <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-md">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-gray-800">Authentication Successful</h1>
            <p className="mt-2 text-gray-600">{message}</p>
          </div>
        </div>
      </div>
    );
  }
  
  // Failed state
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-md">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-800">Authentication Failed</h1>
          <p className="mt-2 text-gray-600">{message}</p>
          
          <button
            onClick={() => window.location.href = '/'}
            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Return to Login
          </button>
        </div>
      </div>
    </div>
  );
} 