'use client';

import { useState, useEffect } from 'react';
import { useFiles, FileObject } from '@/contexts/FileContext';
import { 
  FileAudio, 
  Clock, 
  Calendar,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
  FolderOpen
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/components/ui/button';

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

interface FileListProps {
  files?: FileObject[];
  onSelectFile?: (file: FileObject) => void;
  selectedFileId?: string | null;
  className?: string;
  folderId?: string;
  onShowUpload?: () => void;
}

export function FileList({
  files: propFiles,
  onSelectFile,
  selectedFileId,
  className = '',
  folderId,
  onShowUpload,
}: FileListProps) {
  const { files: contextFiles, selectFile, selectedFile } = useFiles();
  const [folderFiles, setFolderFiles] = useState<FileObject[]>([]);
  const [isLoading, setIsLoading] = useState(folderId ? true : false);
  
  // Fetch files for a specific folder if folderId is provided
  useEffect(() => {
    if (folderId) {
      const fetchFolderFiles = async () => {
        setIsLoading(true);
        const supabase = createClientComponentClient();
        const { data, error } = await supabase
          .from('audio_files')
          .select('*')
          .eq('folder_id', folderId)
          .order('created_at', { ascending: false });
        
        if (data && !error) {
          setFolderFiles(data);
        }
        setIsLoading(false);
      };
      
      fetchFolderFiles();
    }
  }, [folderId]);
  
  // Use either the prop files, folder-specific files, or the files from context
  const files = propFiles || (folderId ? folderFiles : contextFiles);
  
  // Use either the prop selectedFileId or the selectedFile from context
  const currentSelectedFileId = selectedFileId || (selectedFile ? selectedFile.id : null);
  
  // Handle file selection
  const handleFileClick = (file: FileObject) => {
    if (onSelectFile) {
      onSelectFile(file);
    } else {
      selectFile(file);
    }
  };
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground mt-2">Loading files...</p>
      </div>
    );
  }
  
  // Render empty state
  if (files.length === 0) {
    return null;
  }
  
  return (
    <div className={`w-full ${className}`}>
      <div className="rounded-md border">
        <div className="grid grid-cols-12 bg-muted/50 p-2 text-xs font-medium text-muted-foreground">
          <div className="col-span-6 lg:col-span-5">Name</div>
          <div className="col-span-2 hidden lg:block">Duration</div>
          <div className="col-span-2 hidden md:block">Size</div>
          <div className="col-span-4 md:col-span-2">Date</div>
          <div className="col-span-2 md:col-span-1 text-right">Status</div>
        </div>
        
        <div className="divide-y">
          {files.map((file) => {
            const isSelected = currentSelectedFileId === file.id;
            
            return (
              <div
                key={file.id}
                className={`grid grid-cols-12 items-center p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                  isSelected ? 'bg-muted/70' : ''
                }`}
                onClick={() => handleFileClick(file)}
              >
                {/* File name */}
                <div className="col-span-6 lg:col-span-5 flex items-center gap-2 truncate">
                  <FileAudio className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate font-medium">{file.name || file.file_name || "Unnamed File"}</span>
                </div>
                
                {/* Duration */}
                <div className="col-span-2 hidden lg:flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{formatDuration(file.duration)}</span>
                </div>
                
                {/* Size */}
                <div className="col-span-2 hidden md:flex items-center gap-1 text-sm text-muted-foreground">
                  <HardDrive className="h-3.5 w-3.5" />
                  <span>{formatFileSize(file.size)}</span>
                </div>
                
                {/* Date */}
                <div className="col-span-4 md:col-span-2 flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span title={new Date(file.created_at).toLocaleString()}>
                    {formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}
                  </span>
                </div>
                
                {/* Status */}
                <div className="col-span-2 md:col-span-1 flex justify-end">
                  {file.status === 'ready' && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <span className="sr-only">Ready</span>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </div>
                  )}
                  
                  {file.status === 'processing' && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <span className="sr-only">Processing</span>
                      <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                    </div>
                  )}
                  
                  {file.status === 'error' && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <span className="sr-only">Error</span>
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    </div>
                  )}
                  
                  {file.status === 'transcribed' && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <span className="sr-only">Transcribed</span>
                      <CheckCircle2 className="h-4 w-4 text-blue-500" />
                    </div>
                  )}
                  
                  {!file.status && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <span className="sr-only">Unknown</span>
                      <div className="h-4 w-4 rounded-full bg-muted-foreground/30" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
