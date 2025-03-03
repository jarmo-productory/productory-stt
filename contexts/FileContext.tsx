'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSupabase } from '@/hooks/useSupabase';
import { useAuth } from './AuthContext';

// Define file object interface
export interface FileObject {
  id: string;
  name: string;         // Display name (original filename)
  storage_name?: string; // Name in storage (formatted filename)
  size: number;
  created_at: string;
  duration?: number;    // Audio duration in seconds
  status?: 'ready' | 'processing' | 'error' | 'transcribed'; // File processing status
  metadata?: {
    [key: string]: any;
  };
  folder_id?: string | null; // ID of the folder containing this file, null for root
  // Fields from the actual database
  file_name?: string;
  file_path?: string;
  format?: string;
}

// Define sort types
export type SortField = 'name' | 'size' | 'created_at';
export type SortDirection = 'asc' | 'desc';

// Define file context interface
interface FileContextType {
  // File state
  files: FileObject[];
  selectedFile: FileObject | null;
  isLoading: boolean;
  error: string | null;
  sortField: SortField;
  sortDirection: SortDirection;
  searchQuery: string;
  currentFolderId: string | null;
  
  // File operations
  fetchFiles: (folderId?: string | null) => Promise<void>;
  selectFile: (file: FileObject | null) => void;
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
  const [selectedFile, setSelectedFile] = useState<FileObject | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch files from Supabase
  const fetchFiles = async (folderId: string | null = currentFolderId) => {
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
        .eq('user_id', user.id);
      
      // Note: The audio_files table doesn't have a folder_id column
      // We're keeping this code commented for future implementation
      // if (folderId) {
      //   query = query.eq('folder_id', folderId);
      // } else {
      //   query = query.is('folder_id', null);
      // }
      
      // Execute query
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      // Map the database fields to our FileObject interface
      const mappedFiles = data?.map(file => ({
        id: file.id,
        name: file.file_name || 'Unnamed File', // Use file_name as name
        storage_name: file.file_path, // Use file_path as storage_name
        size: file.size || 0,
        created_at: file.created_at,
        duration: file.duration,
        status: file.status,
        metadata: file.metadata,
        folder_id: null, // No folder support yet
        file_name: file.file_name,
        file_path: file.file_path,
        format: file.format
      })) || [];
      
      // Update files state
      setFiles(mappedFiles);
    } catch (err: any) {
      console.error('Error fetching files:', err);
      setError(err.message || 'Failed to fetch files');
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Select a file
  const selectFile = (file: FileObject | null) => {
    setSelectedFile(file);
  };

  // Delete a file
  const deleteFile = async (file: FileObject): Promise<boolean> => {
    if (!user) return false;
    
    try {
      // Delete from storage
      if (file.storage_name || file.file_path) {
        const storagePath = file.storage_name || file.file_path;
        const { error: storageError } = await supabase
          .storage
          .from('audio-files')
          .remove([`${user.id}/${storagePath}`]);
        
        if (storageError) {
          throw storageError;
        }
      }
      
      // Delete from database
      const { error: dbError } = await supabase
        .from('audio_files')
        .delete()
        .eq('id', file.id)
        .eq('user_id', user.id);
      
      if (dbError) {
        throw dbError;
      }
      
      // Update local state
      setFiles(files.filter(f => f.id !== file.id));
      
      // Clear selection if the deleted file was selected
      if (selectedFile && selectedFile.id === file.id) {
        setSelectedFile(null);
      }
      
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
      // Update in database
      const { data, error } = await supabase
        .from('audio_files')
        .update({ file_name: newName }) // Use file_name instead of name
        .eq('id', file.id)
        .eq('user_id', user.id)
        .select();
      
      if (error) {
        throw error;
      }
      
      // Update local state
      setFiles(files.map(f => f.id === file.id ? { ...f, name: newName, file_name: newName } : f));
      
      // Update selected file if it was renamed
      if (selectedFile && selectedFile.id === file.id) {
        setSelectedFile({ ...selectedFile, name: newName, file_name: newName });
      }
      
      return true;
    } catch (err: any) {
      console.error('Error renaming file:', err);
      setError(err.message || 'Failed to rename file');
      return false;
    }
  };

  // Refresh files
  const refreshFiles = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Fetch files when user, folder, or refresh trigger changes
  useEffect(() => {
    if (user) {
      fetchFiles();
    }
  }, [user, refreshTrigger]);

  // Context value
  const value: FileContextType = {
    files,
    selectedFile,
    isLoading,
    error,
    sortField,
    sortDirection,
    searchQuery,
    currentFolderId,
    fetchFiles,
    selectFile,
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