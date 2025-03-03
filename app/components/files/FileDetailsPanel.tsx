'use client';

import { useState, useEffect } from 'react';
import { useFiles, FileObject } from '@/contexts/FileContext';
import { 
  X, 
  FileAudio, 
  Calendar, 
  Clock, 
  HardDrive, 
  FileType, 
  AlertCircle,
  Pencil,
  Save,
  Loader2,
  CheckCircle,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";

// Helper function to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Helper function to format duration
const formatDuration = (seconds?: number): string => {
  if (!seconds) return 'Unknown';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

interface FileDetailsPanelProps {
  file?: FileObject | null;
  onClose?: () => void;
  className?: string;
}

export function FileDetailsPanel({
  file: propFile,
  onClose,
  className = '',
}: FileDetailsPanelProps) {
  const { selectedFile, selectFile, deleteFile, renameFile } = useFiles();
  
  // Use either the prop file or the selected file from context
  const file = propFile || selectedFile;
  
  // State for file renaming
  const [isEditing, setIsEditing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [editedName, setEditedName] = useState('');
  
  // State for file deletion
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Update edited name when file changes
  useEffect(() => {
    if (file) {
      const fileName = file.name || file.file_name || 'Unnamed file';
      const { name: fileNameWithoutExt } = getFileNameAndExtension(fileName);
      setEditedName(fileNameWithoutExt);
    }
  }, [file]);
  
  // Handle close
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      selectFile(null);
    }
  };
  
  // Extract file extension and name
  const getFileNameAndExtension = (filename: string) => {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) return { name: filename, extension: '' };
    
    return {
      name: filename.substring(0, lastDotIndex),
      extension: filename.substring(lastDotIndex)
    };
  };
  
  // Start editing filename
  const startEditing = () => {
    setIsEditing(true);
    setError('');
    setSuccess(false);
  };
  
  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
    setError('');
    
    if (file) {
      const { name: fileNameWithoutExt } = getFileNameAndExtension(file.name);
      setEditedName(fileNameWithoutExt);
    }
  };
  
  // Submit new filename
  const submitNewFilename = async () => {
    if (!file) return;
    
    // Validate filename
    if (!editedName.trim()) {
      setError('Filename cannot be empty');
      return;
    }
    
    setIsProcessing(true);
    setError('');
    
    try {
      const currentFileName = file.name || file.file_name || 'Unnamed file';
      const { extension } = getFileNameAndExtension(currentFileName);
      const newName = `${editedName}${extension}`;
      
      // Don't rename if the name hasn't changed
      if (newName === currentFileName) {
        setIsEditing(false);
        setIsProcessing(false);
        return;
      }
      
      const success = await renameFile(file, newName);
      
      if (success) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setIsEditing(false);
        }, 1500);
      } else {
        setError('Failed to rename file');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Handle delete confirmation
  const handleDeleteConfirm = () => {
    setShowDeleteConfirm(true);
  };
  
  // Execute delete
  const handleDeleteExecute = async () => {
    if (!file) return;
    
    setIsDeleting(true);
    
    try {
      const success = await deleteFile(file);
      
      if (success) {
        handleClose();
      } else {
        setError('Failed to delete file');
        setShowDeleteConfirm(false);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Cancel delete
  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };
  
  // Render status badge
  const StatusBadge = ({ status }: { status?: FileObject['status'] }) => {
    switch (status) {
      case 'ready':
        return (
          <div className="flex items-center gap-1 text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full text-xs">
            <CheckCircle className="h-3 w-3" />
            <span>Ready</span>
          </div>
        );
      case 'processing':
        return (
          <div className="flex items-center gap-1 text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full text-xs">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Processing</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-1 text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full text-xs">
            <AlertCircle className="h-3 w-3" />
            <span>Error</span>
          </div>
        );
      case 'transcribed':
        return (
          <div className="flex items-center gap-1 text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full text-xs">
            <CheckCircle className="h-3 w-3" />
            <span>Transcribed</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1 text-gray-600 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full text-xs">
            <span>Unknown</span>
          </div>
        );
    }
  };
  
  // If no file is selected, don't render anything
  if (!file) {
    return null;
  }
  
  // Use file.name if available, otherwise fall back to file.file_name or a default value
  const fileName = file.name || file.file_name || 'Unnamed file';
  const { extension } = getFileNameAndExtension(fileName);
  
  return (
    <Sheet open={!!file} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent className={`w-full sm:max-w-md ${className}`}>
        <SheetHeader>
          <SheetTitle>
            File Details
          </SheetTitle>
          <SheetDescription>
            View and manage file details
          </SheetDescription>
        </SheetHeader>
        
        <div className="py-6">
          {/* File Icon */}
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center">
              <FileAudio className="h-10 w-10 text-primary" />
            </div>
          </div>
          
          {/* File Name */}
          <div className="mb-6">
            {isEditing ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    placeholder="Enter file name"
                    className="flex-1"
                    disabled={isProcessing}
                  />
                  <span className="text-sm text-muted-foreground">{extension}</span>
                </div>
                
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelEditing}
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                  
                  <Button
                    size="sm"
                    onClick={submitNewFilename}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : success ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-2" />
                        Saved
                      </>
                    ) : (
                      <>
                        <Save className="h-3 w-3 mr-2" />
                        Save
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold truncate">{fileName}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={startEditing}
                  title="Rename file"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          
          {/* File Info */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Size</p>
                <div className="flex items-center gap-1">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <p>{formatFileSize(file.size)}</p>
                </div>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Type</p>
                <div className="flex items-center gap-1">
                  <FileType className="h-4 w-4 text-muted-foreground" />
                  <p>{extension.replace('.', '').toUpperCase() || 'Unknown'}</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Duration</p>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p>{formatDuration(file.duration)}</p>
                </div>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Created</p>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p title={new Date(file.created_at).toLocaleString()}>
                    {format(new Date(file.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="pt-2">
              <p className="text-sm text-muted-foreground mb-1">Status</p>
              <StatusBadge status={file.status} />
            </div>
          </div>
        </div>
        
        {/* File Actions */}
        <SheetFooter className="flex-col items-stretch gap-2 sm:flex-col sm:items-stretch">
          {showDeleteConfirm ? (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive mb-3">
                Are you sure you want to delete this file? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteCancel}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteExecute}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete File
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
