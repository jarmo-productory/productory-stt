'use client';

import { FileObject } from '@/contexts/FileContext';
import { 
  FileAudio, 
  Clock, 
  Calendar,
  HardDrive,
  Trash2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

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
  files: FileObject[];
  onDeleteFile?: (file: FileObject) => void;
  folderId?: string | null;
}

export function FileList({
  files = [],
  onDeleteFile,
  folderId = null,
}: FileListProps) {
  const router = useRouter();

  const handleFileClick = (file: FileObject) => {
    router.push(`/files/${file.id}`);
  };

  // Filter files based on folderId
  const filteredFiles = files.filter(file => {
    if (folderId === null) {
      // If no folderId is provided (dashboard view), show all files
      return true;
    }
    // Show files that match the current folder
    return file.folder_id === folderId;
  });

  if (!filteredFiles || filteredFiles.length === 0) {
    return (
      <div className="text-center py-8">
        <FileAudio className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-muted-foreground">No files found</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="rounded-md border">
        <div className="grid grid-cols-12 bg-muted/50 p-2 text-xs font-medium text-muted-foreground">
          <div className="col-span-6 lg:col-span-5">Name</div>
          <div className="col-span-2 hidden lg:block">Duration</div>
          <div className="col-span-2 hidden md:block">Size</div>
          <div className="col-span-4 md:col-span-2">Date</div>
          <div className="col-span-2 md:col-span-1 text-right">Actions</div>
        </div>
        
        <div className="divide-y">
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              className="grid grid-cols-12 items-center p-3 hover:bg-muted/50 cursor-pointer transition-colors"
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
              
              {/* Actions */}
              <div className="col-span-2 md:col-span-1 flex justify-end">
                {onDeleteFile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent file click when deleting
                      onDeleteFile(file);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
