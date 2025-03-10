'use client';

import { useState, useEffect, ChangeEvent, useCallback } from 'react';
import { FileObject } from "@/contexts/FileContext";
import { 
  FileAudio, 
  Calendar, 
  Clock, 
  HardDrive, 
  FileType, 
  Save,
  Loader2,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { debounce } from 'lodash';
import { Alert, AlertDescription } from "@/components/ui/alert";

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

interface OverviewColumnProps {
  file: FileObject | null;
}

export function OverviewColumn({ file }: OverviewColumnProps) {
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // Fetch notes from API
  const fetchNotes = async (fileId: string) => {
    setIsLoading(true);
    setFetchError(null);
    
    try {
      const response = await fetch(`/api/files/${fileId}/notes`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch notes: ${response.status}`);
      }
      
      const data = await response.json();
      setNotes(data.content || '');
      
      // If we successfully fetched from API, we can clear localStorage
      localStorage.removeItem(`file-notes-${fileId}`);
    } catch (error) {
      console.error('Error fetching notes:', error);
      setFetchError('Failed to load notes. Using local data if available.');
      
      // Fallback to localStorage if available
      const savedNotes = localStorage.getItem(`file-notes-${fileId}`);
      if (savedNotes) {
        setNotes(savedNotes);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load notes when file changes
  useEffect(() => {
    if (file) {
      fetchNotes(file.id);
    } else {
      setNotes('');
      setIsLoading(false);
    }
  }, [file]);
  
  // Save notes to API
  const saveNotes = async () => {
    if (!file) return;
    
    setIsSaving(true);
    setSaveError(null);
    
    try {
      const response = await fetch(`/api/files/${file.id}/notes`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json' 
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({ content: notes }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save notes: ${response.status}`);
      }
      
      // Save successful
      setLastSaved(new Date());
      toast.success('Notes saved successfully');
      
      // Clear localStorage since we've saved to the server
      localStorage.removeItem(`file-notes-${file.id}`);
    } catch (error) {
      console.error('Error saving notes:', error);
      setSaveError('Failed to save notes to server. Saved locally as backup.');
      toast.error('Failed to save notes to server. Saved locally as backup.');
      
      // Save to localStorage as backup
      localStorage.setItem(`file-notes-${file.id}`, notes);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Debounced save function for auto-save
  const debouncedSave = useCallback(
    debounce(() => {
      if (file) {
        saveNotes();
      }
    }, 1000),
    [notes, file]
  );
  
  // Auto-save when notes change
  useEffect(() => {
    if (notes && file) {
      debouncedSave();
    }
    
    // Cleanup debounce on unmount
    return () => {
      debouncedSave.cancel();
    };
  }, [notes, debouncedSave, file]);
  
  // Handle notes change
  const handleNotesChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
    // Auto-save will be triggered by the useEffect above
  };
  
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
    <div className="flex flex-col space-y-4">
      {/* File metadata section */}
      <div className="border rounded-lg p-4 bg-card">
        <h2 className="text-lg font-medium mb-4">Overview</h2>
        
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
      
      {/* Notes section */}
      <div className="border rounded-lg p-4 bg-card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Notes</h2>
          <div className="flex items-center gap-2">
            {lastSaved && !isSaving && !saveError && (
              <span className="text-xs text-muted-foreground">
                Last saved: {format(lastSaved, 'HH:mm:ss')}
              </span>
            )}
            <Button 
              size="sm" 
              onClick={saveNotes}
              disabled={isSaving || isLoading}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                  Saving...
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
        
        {fetchError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{fetchError}</AlertDescription>
          </Alert>
        )}
        
        {saveError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        )}
        
        {isLoading ? (
          <div className="min-h-[150px] flex items-center justify-center bg-muted/30 rounded-md">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Textarea
            placeholder="Add your notes about this file here..."
            className="min-h-[150px] resize-none"
            value={notes}
            onChange={handleNotesChange}
          />
        )}
      </div>
      
      {/* AI Summary section */}
      <div className="border rounded-lg p-4 bg-card">
        <h2 className="text-lg font-medium mb-4">AI Summary</h2>
        <div className="p-4 bg-muted/30 rounded-md">
          <p className="text-muted-foreground text-sm italic">
            AI-generated summary will appear here once the file is processed.
          </p>
        </div>
      </div>
    </div>
  );
}

// Status badge component
function StatusBadge({ status }: { status?: FileObject['status'] }) {
  switch (status) {
    case 'ready':
      return (
        <div className="flex items-center gap-1 text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full text-xs">
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
          <span>Error</span>
        </div>
      );
    case 'transcribed':
      return (
        <div className="flex items-center gap-1 text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full text-xs">
          <span>Transcribed</span>
        </div>
      );
    case 'deleted':
      return (
        <div className="flex items-center gap-1 text-gray-600 bg-gray-50 dark:bg-gray-900/20 px-2 py-1 rounded-full text-xs">
          <Trash2 className="h-3 w-3" />
          <span>Deleted</span>
        </div>
      );
    default:
      return (
        <div className="flex items-center gap-1 text-gray-600 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full text-xs">
          <span>Unknown</span>
        </div>
      );
  }
} 