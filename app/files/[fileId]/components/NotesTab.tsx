'use client';

import { useState, useEffect, ChangeEvent, useCallback } from 'react';
import { FileObject } from "@/contexts/FileContext";
import { 
  Save,
  Loader2,
  AlertCircle,
  StickyNote
} from 'lucide-react';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { debounce } from 'lodash';
import { Alert, AlertDescription } from "@/components/ui/alert";

interface NotesTabProps {
  file: FileObject | null;
}

export function NotesTab({ file }: NotesTabProps) {
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
  
  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <StickyNote className="h-5 w-5 mr-2 text-primary" />
          <h2 className="text-lg font-medium">Notes</h2>
        </div>
        <div className="flex items-center gap-2">
          {lastSaved && !isSaving && !saveError && (
            <span className="text-xs text-muted-foreground">
              Last saved: {new Date(lastSaved).toLocaleTimeString()}
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
          className="min-h-[300px] resize-none"
          value={notes}
          onChange={handleNotesChange}
        />
      )}
    </div>
  );
} 