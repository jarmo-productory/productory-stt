"use client";

// import { useWebSocket } from '@/contexts/WebSocketContext';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { FileProvider, useFiles, FileObject } from '@/contexts/FileContext';

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
  FileAudio,
  FolderPlus,
  Upload,
  RefreshCw
} from 'lucide-react';

// Import our shared components
import { FileUpload } from '@/app/components/files/FileUpload';
import { AppLayout } from "@/app/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { FileList } from '@/app/components/files/FileList';

const AUTH_TIMEOUT = 15000; // 15 seconds

// Create a wrapper component to access the FileContext
function DashboardContent() {
  const { user } = useAuth();
  const router = useRouter();
  const { files, refreshFiles, isLoading: filesLoading, deleteFile } = useFiles();
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  
  // Check if user has files
  const hasFiles = files.length > 0;
  
  // Check if user is a first-time user (no files)
  useEffect(() => {
    if (files && !filesLoading) {
      setIsFirstTimeUser(files.length === 0);
    }
  }, [files, filesLoading]);
  
  // Handle file upload complete
  const handleUploadComplete = useCallback(() => {
    // Show a toast notification
    toast.success(
      <div className="flex flex-col">
        <div className="font-medium">File uploaded successfully!</div>
        <div className="text-xs mt-1">
          <button 
            className="text-primary hover:underline" 
            onClick={() => router.push('/folders')}
          >
            Create folders to organize your files
          </button>
        </div>
      </div>,
      {
        duration: 4000,
        position: "top-right"
      }
    );
    
    // Refresh the file list with loading indicator
    setIsRefreshing(true);
    
    // Force a refresh of the files
    refreshFiles();
    
    // Note: The FileUpload component will clear selected files internally
    
    // Set a timeout to ensure the refreshing state is visible
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  }, [refreshFiles, router]);
  
  // Handle manual refresh
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    refreshFiles();
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [refreshFiles]);
  
  // Handle file selection
  const handleFileSelect = useCallback((file: FileObject) => {
    setSelectedFileId(file.id);
    router.push(`/files/${file.id}`);
  }, [router]);
  
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Dashboard</h1>
      </div>
      
      {/* First-time user welcome */}
      {isFirstTimeUser && (
        <Alert className="bg-primary/10 border-primary/20">
          <FileAudio className="h-4 w-4" />
          <AlertTitle>Welcome to your audio dashboard!</AlertTitle>
          <AlertDescription>
            Upload your first audio file to get started. Files will be uploaded to your library.
          </AlertDescription>
        </Alert>
      )}
      
      {/* File Upload Section */}
      <FileUpload 
        className="mb-8" 
        onUploadComplete={handleUploadComplete}
        uploadContext="dashboard"
      />
      
      {/* Files Section - Show loading state during refresh */}
      {isRefreshing ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center">
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Refreshing Files...
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      ) : hasFiles ? (
        <FileList
          files={files}
          onDeleteFile={deleteFile}
          folderId={null}
        />
      ) : filesLoading ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Your Files</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default function DashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
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
        <DashboardContent />
      </FileProvider>
    </AppLayout>
  );
}