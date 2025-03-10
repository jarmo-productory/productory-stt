'use client';

import { FileObject } from "@/contexts/FileContext";
import { 
  FileAudio, 
  Calendar, 
  Clock, 
  HardDrive, 
  FileType,
  Info
} from 'lucide-react';
import { format } from 'date-fns';

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

interface OverviewTabProps {
  file: FileObject | null;
}

export function OverviewTab({ file }: OverviewTabProps) {
  if (!file) {
    return <div className="p-4">No file selected</div>;
  }
  
  // Extract file extension
  const getFileExtension = (filename: string) => {
    if (!filename) return '';
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) return '';
    return filename.substring(lastDotIndex);
  };
  
  // Ensure we're using the most up-to-date display name
  const fileName = file?.metadata?.display_name || file?.name || file?.file_name || 'Unnamed file';
  const extension = getFileExtension(fileName);
  
  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="flex items-center mb-4">
        <Info className="h-5 w-5 mr-2 text-primary" />
        <h2 className="text-lg font-medium">Overview</h2>
      </div>
      
      {/* File Icon */}
      <div className="flex justify-center mb-4">
        <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
          <FileAudio className="h-8 w-8 text-primary" />
        </div>
      </div>
      
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
  );
}

function StatusBadge({ status }: { status?: FileObject['status'] }) {
  let badgeClass = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';
  let statusText = 'Unknown';
  
  switch (status) {
    case 'processing':
      badgeClass += ' bg-blue-100 text-blue-800';
      statusText = 'Processing';
      break;
    case 'ready':
      badgeClass += ' bg-green-100 text-green-800';
      statusText = 'Ready';
      break;
    case 'error':
      badgeClass += ' bg-red-100 text-red-800';
      statusText = 'Error';
      break;
    case 'deleted':
      badgeClass += ' bg-gray-100 text-gray-800';
      statusText = 'Deleted';
      break;
    default:
      badgeClass += ' bg-gray-100 text-gray-800';
      statusText = status || 'Unknown';
  }
  
  return (
    <span className={badgeClass}>
      {statusText}
    </span>
  );
} 