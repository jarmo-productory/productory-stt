'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useSupabase } from '@/hooks/useSupabase';
import { useAuth } from './AuthContext';
import { storagePathUtil } from '@/lib/utils/storage';

// Define file object interface
export interface FileObject {
  id: string;
  name: string;         // Display name (original filename)
  storage_name?: string; // Name in storage (formatted filename)
  size: number;
  created_at: string;
  duration?: number;    // Audio duration in seconds
  status?: 'ready' | 'processing' | 'error' | 'transcribed' | 'deleted'; // File processing status
  metadata?: {
    [key: string]: any;
  };
  folder_id?: string | null; // ID of the folder containing this file, null for root
  // Fields from the actual database
  file_name?: string;
  file_path?: string;
  format?: string;
  // Epic-6 storage fields
  bucket_name?: string;
  storage_prefix?: string;
  normalized_path?: string; // Full normalized storage path
}

// Define sort types
export type SortField = 'name' | 'size' | 'created_at';
export type SortDirection = 'asc' | 'desc';

// Define file context interface
interface FileContextType {
  // File state
  files: FileObject[];
  isLoading: boolean;
  error: string | null;
  sortField: SortField;
  sortDirection: SortDirection;
  searchQuery: string;
  currentFolderId: string | null;
  
  // File operations
  fetchFiles: (folderId?: string | null) => Promise<void>;
  deleteFile: (file: FileObject) => Promise<boolean>;
  renameFile: (file: FileObject, newName: string) => Promise<boolean>;
  setSortField: (field: SortField) => void;
  setSortDirection: (direction: SortDirection) => void;
  setSearchQuery: (query: string) => void;
  setCurrentFolderId: (folderId: string | null) => void;
  refreshFiles: () => void;
}

// Create context
const FileContext = createContext<FileContextType | undefined>(undefined);

// Provider component
export function FileProvider({ children }: { children: ReactNode }) {
  const supabase = useSupabase();
  const { user } = useAuth();
  
  // State
  const [files, setFiles] = useState<FileObject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [retryTimeout, setRetryTimeout] = useState<NodeJS.Timeout | null>(null);

  // Clear retry timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [retryTimeout]);

  // Fetch files from Supabase with retry logic
  const fetchFiles = useCallback(async (folderId: string | null = currentFolderId) => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Update current folder ID
      setCurrentFolderId(folderId);
      
      // Query files from the database
      let query = supabase
        .from('audio_files')
        .select('*')
        .eq('user_id', user.id)
        .neq('status', 'deleted'); // Filter out deleted files
      
      // Filter by folder if specified
      if (folderId) {
        query = query.eq('folder_id', folderId);
      }
      
      // Execute query with timeout
      const fetchPromise = query;
      const timeoutPromise = new Promise((_, reject) => {
        const id = setTimeout(() => {
          clearTimeout(id);
          reject(new Error('Request timed out. Please try again.'));
        }, 10000); // 10 second timeout
      });
      
      // Race between fetch and timeout
      const { data, error } = await Promise.race([
        fetchPromise,
        timeoutPromise.then(() => ({ data: null, error: new Error('Request timed out') }))
      ]) as any;
      
      if (error) {
        throw error;
      }
      
      // Reset retry attempts on success
      setRetryAttempts(0);
      
      // Map the database fields to our FileObject interface
      const mappedFiles = data?.map((file: any) => ({
        id: file.id,
        name: file.metadata?.display_name || file.file_name || 'Unnamed File', // Prioritize display_name from metadata
        storage_name: file.file_path, // Use file_path as storage_name
        size: file.size || 0,
        created_at: file.created_at,
        duration: file.duration,
        status: file.status,
        metadata: file.metadata,
        folder_id: file.folder_id || null,
        file_name: file.file_name,
        file_path: file.file_path,
        format: file.format,
        // Include Epic-6 storage fields
        bucket_name: file.bucket_name,
        storage_prefix: file.storage_prefix,
        normalized_path: file.normalized_path
      })) || [];
      
      // Update files state
      setFiles(mappedFiles);
    } catch (err: any) {
      console.error('Error fetching files:', err);
      
      // Set error message
      setError(err.message || 'Failed to fetch files. Please try again.');
      
      // Implement exponential backoff for retries
      if (retryAttempts < 3) { // Max 3 retry attempts
        const delay = Math.pow(2, retryAttempts) * 1000; // Exponential backoff: 1s, 2s, 4s
        console.log(`Retrying in ${delay}ms (attempt ${retryAttempts + 1}/3)...`);
        
        const timeout = setTimeout(() => {
          setRetryAttempts(prev => prev + 1);
          fetchFiles(folderId);
        }, delay);
        
        setRetryTimeout(timeout);
      } else {
        // Reset retry attempts after max attempts reached
        setRetryAttempts(0);
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentFolderId, supabase, user, retryAttempts]);

  // Delete a file
  const deleteFile = async (file: FileObject): Promise<boolean> => {
    if (!user) return false;
    
    try {
      // Update file status to 'deleted' in the database (soft delete)
      const { error: dbError } = await supabase
        .from('audio_files')
        .update({ status: 'deleted' })
        .eq('id', file.id)
        .eq('user_id', user.id);
      
      if (dbError) {
        throw dbError;
      }
      
      // Update local state by removing the file from the list
      setFiles(files.filter(f => f.id !== file.id));
      
      return true;
    } catch (err: any) {
      console.error('Error deleting file:', err);
      setError(err.message || 'Failed to delete file');
      return false;
    }
  };

  // Rename a file
  const renameFile = async (file: FileObject, newName: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      // Check if we need to update the file in storage
      if (file.file_path) {
        // Get the file extension from the original file path
        const fileExtension = file.file_path.split('.').pop() || '';
        
        // Generate a new formatted filename with the same extension
        const newFormattedFilename = `${newName.replace(/\s+/g, '_')}.${fileExtension}`;
        
        // Get the original file path and construct the new path
        const originalPath = file.file_path.startsWith('audio/') 
          ? file.file_path 
          : storagePathUtil.getAudioPath(user.id, file.file_path);
          
        const newPath = storagePathUtil.getAudioPath(user.id, newFormattedFilename);
        
        console.log('Renaming file in storage:', { originalPath, newPath });
        
        // Copy the file to the new location
        const { data: copyData, error: copyError } = await supabase
          .storage
          .from('audio-files')
          .copy(originalPath, newPath);
          
        if (copyError) {
          console.error("Error copying file in storage:", copyError);
          throw copyError;
        }
        
        console.log('File copied successfully:', copyData);
        
        // Update only the file_name in the database
        // The trigger will handle updating the file_path
        const { data, error } = await supabase
          .from('audio_files')
          .update({ file_name: newName })
          .eq('id', file.id)
          .eq('user_id', user.id)
          .select();
        
        if (error) {
          throw error;
        }
        
        // Delete the original file from storage (only after successful copy and DB update)
        const { error: deleteError } = await supabase
          .storage
          .from('audio-files')
          .remove([originalPath]);
          
        if (deleteError) {
          console.warn("Warning: Could not delete original file from storage:", deleteError);
          // We don't throw here as the rename operation is still successful
        }
        
        // Update local state
        setFiles(files.map(f => f.id === file.id ? { 
          ...f, 
          name: newName, 
          file_name: newName
          // file_path and normalized_path will be updated by the database trigger
        } : f));
        
        return true;
      } else {
        // If we don't have file path info, just update the display name
        const { data, error } = await supabase
          .from('audio_files')
          .update({ file_name: newName })
          .eq('id', file.id)
          .eq('user_id', user.id)
          .select();
        
        if (error) {
          throw error;
        }
        
        // Update local state
        setFiles(files.map(f => f.id === file.id ? { ...f, name: newName, file_name: newName } : f));
        
        return true;
      }
    } catch (err: any) {
      console.error('Error renaming file:', err);
      setError(err.message || 'Failed to rename file');
      return false;
    }
  };

  // Refresh files
  const refreshFiles = useCallback(() => {
    setRetryAttempts(0); // Reset retry attempts
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Fetch files when user, folder, or refresh trigger changes
  useEffect(() => {
    if (user) {
      fetchFiles();
    }
  }, [user, refreshTrigger, fetchFiles]);

  // Context value
  const value: FileContextType = {
    files,
    isLoading,
    error,
    sortField,
    sortDirection,
    searchQuery,
    currentFolderId,
    fetchFiles,
    deleteFile,
    renameFile,
    setSortField,
    setSortDirection,
    setSearchQuery,
    setCurrentFolderId,
    refreshFiles
  };

  return (
    <FileContext.Provider value={value}>
      {children}
    </FileContext.Provider>
  );
}

// Custom hook to use the file context
export function useFiles() {
  const context = useContext(FileContext);
  
  if (context === undefined) {
    throw new Error('useFiles must be used within a FileProvider');
  }
  
  return context;
} 