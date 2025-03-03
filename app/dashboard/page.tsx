"use client";

// import { useWebSocket } from '@/contexts/WebSocketContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { FileProvider } from '@/contexts/FileContext';

import { useRouter, useSearchParams } from 'next/navigation';
import { useSubscription } from '@/hooks/useSubscription';
// import { OnboardingTour } from '@/components/OnboardingTour';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check,
  AlertCircle,
  X,
  Loader2,
  FileAudio
} from 'lucide-react';

// Import our shared components
import { FileDetailsPanel } from '@/app/components/files/FileDetailsPanel';
import { FileUpload } from '@/app/components/files/FileUpload';
import { RecentFiles } from '@/app/components/files/RecentFiles';
import { AppLayout } from "@/app/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const AUTH_TIMEOUT = 15000; // 15 seconds

export default function DashboardPage() {
  // const { isConnected } = useWebSocket();
  // const [fullResponse, setFullResponse] = useState('');
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [isPageLoading, setIsPageLoading] = useState(true);

  // Initialize - check auth once
  useEffect(() => {
    // Just set loading to false after a brief delay
    const timer = setTimeout(() => {
      setIsPageLoading(false);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  // If still loading, show spinner
  if (isPageLoading) {
    return (
      <div className="min-h-screen flex flex-col space-y-4 items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-foreground">Loading dashboard...</div>
      </div>
    );
  }

  // Return dashboard with AppLayout
  return (
    <AppLayout>
      <FileProvider>
        <div className="space-y-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          
          {/* File Upload Section */}
          <FileUpload className="mb-8" />
          
          {/* Recent Files Section */}
          <RecentFiles />
          
          {/* File Details Panel */}
          <FileDetailsPanel />
        </div>
      </FileProvider>
    </AppLayout>
  );
}