"use client";

// import { useWebSocket } from '@/contexts/WebSocketContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';

import { useRouter } from 'next/navigation';
import { useSubscription } from '@/hooks/useSubscription';
// import { OnboardingTour } from '@/components/OnboardingTour';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check,
  AlertCircle,
  X,
} from 'lucide-react';

// Import our new components
import { FileUpload } from './components/FileUpload/FileUpload';
import { FileManager } from './components/FileManager/FileManager';

const AUTH_TIMEOUT = 15000; // 15 seconds

export default function Dashboard() {
  // const { isConnected } = useWebSocket();
  // const [fullResponse, setFullResponse] = useState('');
  const { user, isSubscriber, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const { subscription, isLoading: isSubLoading, fetchSubscription } = useSubscription();
  const [hasCheckedSubscription, setHasCheckedSubscription] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const { isInTrial, isLoading: isTrialLoading } = useTrialStatus();
  const [authTimeout, setAuthTimeout] = useState(false);
  
  // State to trigger file list refresh
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // UI state
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Function to refresh file list
  const refreshFileList = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // First check - Subscription and trial check
  useEffect(() => {
    if (isSubLoading || isTrialLoading) return;
    
    const hasValidSubscription = ['active', 'trialing'].includes(subscription?.status || '');
    
    console.log('Access check isInTrial:', {
      hasSubscription: !!subscription,
      status: subscription?.status,
      isInTrial: isInTrial,
      validUntil: subscription?.current_period_end
    });

    // TEMPORARILY DISABLED: Allow access even with expired trial
    // Only redirect if there's no valid subscription AND no valid trial
    // if (!hasValidSubscription && !isInTrial) {
    //   console.log('No valid subscription or trial, redirecting');
    //   router.replace('/profile');
    // }
  }, [subscription, isSubLoading, isTrialLoading, router, isInTrial]);

  // Second check - Auth check
  useEffect(() => {
    if (isAuthLoading || isTrialLoading) return;

    console.log('Access check:', {
      isSubscriber,
      hasCheckedSubscription,
      isInTrial: isInTrial,
      authLoading: isAuthLoading,
    });

    if (!hasCheckedSubscription) {
      setHasCheckedSubscription(true);
      
      // MODIFIED: Only check for user authentication, not subscription status
      if (!user) {
        console.log('No user authenticated, redirecting');
        router.replace('/profile');
      }
    }
  }, [isSubscriber, isAuthLoading, hasCheckedSubscription, router, user, subscription, isTrialLoading, isInTrial]);

  // Add refresh effect
  useEffect(() => {
    const refreshSubscription = async () => {
      await fetchSubscription();
      setHasCheckedSubscription(true);
    };
    
    if (user?.id) {
      refreshSubscription();
    }
  }, [user?.id, fetchSubscription]);

  useEffect(() => {
    if (user?.id) {
      // Check if user has completed onboarding
      const checkOnboarding = async () => {
        const { data } = await supabase
          .from('user_preferences')
          .select('has_completed_onboarding')
          .eq('user_id', user.id)
          .single();
        
        setHasCompletedOnboarding(!!data?.has_completed_onboarding);
        console.log('hasCompletedOnboarding: ', hasCompletedOnboarding);
      };
      
      checkOnboarding();
    }
  }, [user?.id, hasCompletedOnboarding]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!user && (isAuthLoading || isTrialLoading)) {
        setAuthTimeout(true);
      }
    }, AUTH_TIMEOUT);
    
    return () => clearTimeout(timer);
  }, [user, isAuthLoading, isTrialLoading]);

  // Clear success message after 5 seconds
  useEffect(() => {
    if (showSuccessMessage) {
      const timer = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [showSuccessMessage]);

  // Timeout / Loading screen
  if (authTimeout && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Connection is taking longer than expected
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Please check your connection and try refreshing the page.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  // Handle file upload completion
  const handleUploadComplete = () => {
    // Refresh the file list without showing duplicate success message
    refreshFileList();
    // Remove this if it's showing a success message
    // setSuccessMessage('Files uploaded successfully');
    // setShowSuccessMessage(true);
  };

  // Handle file upload start
  const handleUploadStart = () => {
    // Clear error message when starting a new upload
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120]">
      {/* Dashboard Header */}
      <div className="bg-white dark:bg-neutral-dark border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Audio Files
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {isInTrial ? "Trial Period" : "Premium Plan"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Trial Expired Warning Banner */}
      {!isInTrial && !['active', 'trialing'].includes(subscription?.status || '') && (
        <div className="bg-yellow-100 dark:bg-yellow-900/30 border-b border-yellow-200 dark:border-yellow-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mr-2" />
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  Your trial period has expired. Please subscribe to continue using all features.
                </p>
              </div>
              <button
                onClick={() => router.push('/profile')}
                className="ml-4 px-3 py-1 text-xs font-medium text-yellow-800 dark:text-yellow-300 bg-yellow-200 dark:bg-yellow-800/50 rounded-md hover:bg-yellow-300 dark:hover:bg-yellow-800 transition-colors"
              >
                Subscribe Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Notification */}
        <AnimatePresence>
          {showSuccessMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-4 p-4 bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-900 rounded-lg flex items-center"
            >
              <Check className="h-5 w-5 text-green-500 mr-3" />
              <p className="text-green-800 dark:text-green-300 text-sm">{successMessage}</p>
              <button 
                onClick={() => setShowSuccessMessage(false)}
                className="ml-auto p-1 text-green-500 hover:text-green-700 dark:hover:text-green-300"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Notification */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-4 p-4 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg flex items-center"
            >
              <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
              <p className="text-red-800 dark:text-red-300 text-sm">{errorMessage}</p>
              <button 
                onClick={() => setErrorMessage('')}
                className="ml-auto p-1 text-red-500 hover:text-red-700 dark:hover:text-red-300"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* File Upload Component */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <FileUpload 
            onUploadComplete={handleUploadComplete}
            onUploadStart={handleUploadStart}
          />
        </motion.div>

        {/* File Manager */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-8"
        >
          <FileManager refreshTrigger={refreshTrigger} />
        </motion.div>
      </div>
    </div>
  );
}