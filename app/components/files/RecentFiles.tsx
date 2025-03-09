'use client';

import { useFiles, FileObject } from '@/contexts/FileContext';
import { 
  FileAudio, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  X,
  FolderPlus
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from 'next/navigation';

interface RecentFilesProps {
  className?: string;
  maxFiles?: number;
  showEmptyState?: boolean;
  showRefreshButton?: boolean;
}

export function RecentFiles({
  className = '',
  maxFiles = 5,
  showEmptyState = false,
  showRefreshButton = true
}: RecentFilesProps) {
  const { 
    files, 
    isLoading, 
    error, 
    refreshFiles,
    deleteFile,
  } = useFiles();
  
  const [fileToDelete, setFileToDelete] = useState<FileObject | null>(null);
  const router = useRouter();
  
  // Get the most recent files, limited by maxFiles
  const recentFiles = [...files]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, maxFiles);
  
  // Handle refresh
  const handleRefresh = () => {
    refreshFiles();
  };
  
  // Handle file selection
  const handleFileClick = (file: FileObject) => {
    // Don't navigate if we're in delete confirmation mode
    if (fileToDelete) return;
    
    // Navigate to the file details page
    router.push(`/files/${file.id}`);
  };
  
  // Handle delete confirmation
  const handleDeleteClick = (e: React.MouseEvent, file: FileObject) => {
    e.stopPropagation(); // Prevent file selection
    setFileToDelete(file);
  };
  
  // Execute delete
  const handleDeleteConfirm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileToDelete) {
      await deleteFile(fileToDelete);
      setFileToDelete(null);
    }
  };
  
  // Cancel delete
  const handleDeleteCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFileToDelete(null);
  };
  
  // If loading, show loading state
  if (isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center py-8 ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
        <p className="text-muted-foreground">Loading your files...</p>
      </div>
    );
  }
  
  // If error, show error state
  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center py-8 ${className}`}>
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-destructive">{error}</p>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-4"
          onClick={handleRefresh}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }
  
  // If no files, show a simple message (parent component will handle showing/hiding the entire section)
  if (recentFiles.length === 0) {
    return (
      <div className={`text-center py-4 ${className}`}>
        <p className="text-muted-foreground">No files found.</p>
      </div>
    );
  }
  
  // Render file list
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        {/* Only show "Recent Files" title if maxFiles is small */}
        {maxFiles <= 10 ? (
          <h2 className="text-lg font-medium">Recent Files</h2>
        ) : null}
        
        {/* Only show refresh button if showRefreshButton is true */}
        {showRefreshButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="ml-auto"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        )}
      </div>
      
      <div className="space-y-2">
        {recentFiles.map((file) => (
          <div
            key={file.id}
            className={`p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer ${
              fileToDelete && fileToDelete.id === file.id ? 'bg-destructive/10 border-destructive/30' : ''
            }`}
            onClick={() => handleFileClick(file)}
          >
            {fileToDelete && fileToDelete.id === file.id ? (
              // Delete confirmation UI
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-destructive mr-2" />
                  <span>Delete "{file.name}"?</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={handleDeleteConfirm}
                  >
                    Delete
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleDeleteCancel}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              // Normal file display
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <FileAudio className="h-5 w-5 text-muted-foreground mr-3" />
                  <div>
                    <div className="font-medium text-sm">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={(e) => handleDeleteClick(e, file)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 