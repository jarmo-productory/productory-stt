'use client';

import { useFiles, FileObject } from '@/contexts/FileContext';
import { 
  FileAudio, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  X
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

interface RecentFilesProps {
  className?: string;
  maxFiles?: number;
}

export function RecentFiles({
  className = '',
  maxFiles = 5
}: RecentFilesProps) {
  const { 
    files, 
    isLoading, 
    error, 
    refreshFiles,
    deleteFile,
    selectFile
  } = useFiles();
  
  const [fileToDelete, setFileToDelete] = useState<FileObject | null>(null);
  
  // Get the most recent files
  const recentFiles = [...files]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, maxFiles);
  
  // Handle refresh
  const handleRefresh = () => {
    refreshFiles();
  };
  
  // Handle file selection
  const handleFileClick = (file: FileObject) => {
    // Don't select file if we're in delete confirmation mode
    if (fileToDelete) return;
    selectFile(file);
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
  
  // Render loading state
  if (isLoading) {
    return (
      <Card className={`w-full ${className}`}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Recent Files</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <p className="text-muted-foreground">Loading files...</p>
        </CardContent>
      </Card>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <Card className={`w-full ${className}`}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Recent Files</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-6">
          <AlertCircle className="h-8 w-8 text-destructive mb-2" />
          <p className="text-destructive font-medium">Error loading files</p>
          <p className="text-muted-foreground text-sm mt-1">{error}</p>
        </CardContent>
      </Card>
    );
  }
  
  // Render empty state
  if (recentFiles.length === 0) {
    return (
      <Card className={`w-full ${className}`}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Recent Files</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <FileAudio className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-1">No files yet</p>
          <p className="text-muted-foreground text-sm text-center">
            Upload your first audio file to get started with transcription
          </p>
        </CardContent>
      </Card>
    );
  }
  
  // Render file list
  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Recent Files</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {recentFiles.map((file) => (
            <div
              key={file.id}
              className={`flex items-center justify-between p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors ${
                fileToDelete?.id === file.id ? 'bg-muted' : ''
              }`}
              onClick={() => handleFileClick(file)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileAudio className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <span className="font-medium truncate">{file.name}</span>
              </div>
              
              <div className="flex items-center gap-3 flex-shrink-0">
                {/* Delete confirmation UI */}
                {fileToDelete?.id === file.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-destructive font-medium">Delete?</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={handleDeleteConfirm}
                      title="Confirm delete"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={handleDeleteCancel}
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}
                    </span>
                    
                    {/* Status indicator */}
                    <div className="flex items-center">
                      {file.status === 'ready' && (
                        <div className="flex items-center" title="Ready">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        </div>
                      )}
                      
                      {file.status === 'processing' && (
                        <div className="flex items-center" title="Processing">
                          <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
                        </div>
                      )}
                      
                      {file.status === 'error' && (
                        <div className="flex items-center" title="Error">
                          <AlertCircle className="h-5 w-5 text-destructive" />
                        </div>
                      )}
                      
                      {file.status === 'transcribed' && (
                        <div className="flex items-center" title="Transcribed">
                          <CheckCircle2 className="h-5 w-5 text-blue-500" />
                        </div>
                      )}
                      
                      {!file.status && (
                        <div className="flex items-center" title="Unknown">
                          <div className="h-5 w-5 rounded-full bg-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    
                    {/* Delete button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => handleDeleteClick(e, file)}
                      title="Delete file"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
} 