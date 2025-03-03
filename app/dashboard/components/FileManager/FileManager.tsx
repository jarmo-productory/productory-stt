import { useState, useEffect, useReducer, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import { 
  Search,
  SortAsc,
  SortDesc,
  RefreshCw,
  Loader2,
  FileAudio,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock
} from 'lucide-react';

import { formatFileSize } from '../utils/fileHelpers';
import FileDetailsPanel from './FileDetailsPanel';

// Declare global properties on window object for TypeScript
declare global {
  interface Window {
    _handlingVisibility?: boolean;
    _blockLoading?: boolean;
  }
}

// --- File Types ---
interface FileObject {
  id: string;
  name: string;         // Display name (original filename)
  storage_name?: string; // Name in storage (formatted filename)
  size: number;
  created_at: string;
  duration?: number; // Audio duration in seconds
  status?: 'ready' | 'processing' | 'error' | 'transcribed'; // File processing status
  metadata?: {
    [key: string]: any;
  };
}

interface FileManagerProps {
  refreshTrigger: number;
}

// --- Sort Types ---
type SortField = 'name' | 'size' | 'created_at';
type SortDirection = 'asc' | 'desc';

// --- State Management ---
type FileState = {
  files: FileObject[];
  isLoading: boolean;
  error: string | null;
  lastFetchTime: number | null;
  hasBeenFetched: boolean;
}

type FileAction = 
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: FileObject[] }
  | { type: 'FETCH_ERROR'; payload: string }
  | { type: 'DELETE_FILE'; payload: string }  // file id
  | { type: 'RENAME_FILE'; payload: { id: string; newName: string } }
  | { type: 'CANCEL_LOADING' };

// Reducer for file state management
function fileReducer(state: FileState, action: FileAction): FileState {
  switch (action.type) {
    case 'FETCH_START':
      // Only show loading if we've never loaded files before
      return {
        ...state,
        isLoading: !state.hasBeenFetched,
        error: null
      };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        files: action.payload,
        isLoading: false,
        error: null,
        lastFetchTime: Date.now(),
        hasBeenFetched: true
      };
    case 'FETCH_ERROR':
      return {
        ...state,
        isLoading: false,
        error: action.payload,
        lastFetchTime: Date.now()
      };
    case 'DELETE_FILE':
      return {
        ...state,
        files: state.files.filter(file => file.id !== action.payload)
      };
    case 'RENAME_FILE':
      return {
        ...state,
        files: state.files.map(file => 
          file.id === action.payload.id 
            ? { ...file, name: action.payload.newName } 
            : file
        )
      };
    case 'CANCEL_LOADING':
      return {
        ...state,
        isLoading: false
      };
    default:
      return state;
  }
}

export function FileManager({ refreshTrigger }: FileManagerProps) {
  const { user } = useAuth();
  
  // --- Main State (Reducer) ---
  const [fileState, dispatch] = useReducer(fileReducer, {
    files: [],
    isLoading: true,
    error: null,
    lastFetchTime: null,
    hasBeenFetched: false
  });
  
  // --- UI State ---
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // --- Modal State ---
  const [selectedFile, setSelectedFile] = useState<FileObject | null>(null);
  const [fileToDelete, setFileToDelete] = useState<FileObject | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  
  // --- File Fetching Logic ---
  const fetchUserFiles = useCallback(async (showLoading = true) => {
    if (!user) {
      console.log('No user found for fetch, aborting');
      dispatch({ type: 'FETCH_ERROR', payload: 'Authentication required. Please sign in again if this persists.' });
      return;
    }
    
    // Only dispatch loading if showLoading is true
    if (showLoading) {
      dispatch({ type: 'FETCH_START' });
    }
    
    console.log(`Fetching files for user ID: ${user.id}`);
    
    try {
      // Make the Supabase request
      const { data: fileList, error } = await supabase
        .storage
        .from('audio-files')
        .list(`audio/${user.id}`);
      
      if (error) {
        console.error('Error fetching files:', error);
        dispatch({ type: 'FETCH_ERROR', payload: 'Failed to load your files. Please try again later.' });
        return;
      }
      
      // Get files from the audio_files table to get real durations
      const { data: audioMetadata, error: metadataError } = await supabase
        .from('audio_files')
        .select('*')
        .eq('user_id', user.id);
        
      if (metadataError) {
        console.error('Error fetching audio metadata:', metadataError);
        // Continue anyway - we'll just show Unknown for durations
      }
      
      // Map the storage files with the metadata
      const files: FileObject[] = fileList
        .filter(item => !item.id.endsWith('/')) // Filter out folders
        .map(item => {
          // Find matching metadata
          const metadata = audioMetadata?.find(meta => 
            meta.file_path === item.name || // Match by file_path
            meta.file_name === item.name.split('/').pop() // Or by file_name
          );
          
          return {
            id: metadata?.id || item.id,
            name: metadata?.file_name || item.name.split('/').pop() || 'Unknown',
            storage_name: item.name,
            size: item.metadata?.size || 0,
            created_at: metadata?.created_at || item.created_at || new Date().toISOString(),
            duration: metadata?.duration || 0,
            status: metadata?.status || 'ready',
            metadata: metadata?.metadata || {}
          };
        });
      
      dispatch({ type: 'FETCH_SUCCESS', payload: files });
      console.log(`Successfully loaded ${files.length} files`);
    } catch (error) {
      console.error('Unexpected error fetching files:', error);
      dispatch({ type: 'FETCH_ERROR', payload: 'An unexpected error occurred while loading your files.' });
    }
  }, [user]);
  
  // Initial file load when component mounts
  useEffect(() => {
    console.log('Component mounted or refreshTrigger/user changed');
    
    if (document.visibilityState === 'visible') {
      fetchUserFiles(true);
    } else {
      // If we're in a background tab, don't show a loading state
      dispatch({ type: 'CANCEL_LOADING' });
    }
  }, [fetchUserFiles, refreshTrigger]);
  
  // Handle visibility changes
  useEffect(() => {
    let isVisibilityChangeHandled = false;
    const visibilityTimeout = 300; // ms to wait after visibility change
    
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      console.log(`Visibility changed to: ${isVisible ? 'visible' : 'hidden'}`);
      
      if (isVisible) {
        if (isVisibilityChangeHandled) return;
        isVisibilityChangeHandled = true;
        
        console.log('Tab became visible, checking file state');
        
        // If we already have files, don't show loading spinner when refreshing
        const hasFiles = fileState.files.length > 0;
        
        // Don't show loading state if we already have files
        if (hasFiles) {
          console.log('We have files, refreshing in background without loading state');
          fetchUserFiles(false);
        } else {
          fetchUserFiles(true);
        }
        
        // Reset the flag after a delay
        setTimeout(() => {
          isVisibilityChangeHandled = false;
        }, visibilityTimeout);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchUserFiles, fileState.files.length]);
  
  // Handle manual refresh button click
  const handleManualRefresh = () => {
    console.log('Manual refresh button clicked');
    fetchUserFiles(true);
  };
  
  // Handle file deletion
  const handleDeleteFile = async () => {
    if (!fileToDelete || !user) return;
    
    setIsDeleting(true);
    setDeleteError('');
    
    try {
      const storageFileName = fileToDelete.storage_name || fileToDelete.name;
      console.log(`Attempting to delete file: ${storageFileName} (display name: ${fileToDelete.name})`);
      
      const { error } = await supabase
        .storage
        .from('audio-files')
        .remove([`audio/${user.id}/${storageFileName}`]);
      
      if (error) {
        console.error('Error deleting file:', error);
        setDeleteError(`Failed to delete ${fileToDelete.name}. Please try again.`);
      } else {
        console.log(`Successfully deleted file: ${storageFileName}`);
        // Update state
        dispatch({ type: 'DELETE_FILE', payload: fileToDelete.id });
        
        // Also delete from audio_files table
        const { error: dbError } = await supabase
          .from('audio_files')
          .delete()
          .eq('file_path', `audio/${user.id}/${storageFileName}`);
          
        if (dbError) {
          console.error('Error deleting metadata from database:', dbError);
          // We successfully deleted from storage, so don't show an error
        }
      }
    } catch (error) {
      console.error('Unexpected error during deletion:', error);
      setDeleteError('An unexpected error occurred. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setFileToDelete(null);
    }
  };

  // Prompt for file deletion
  const promptDeleteFile = (file: FileObject) => {
    setFileToDelete(file);
    setShowDeleteConfirm(true);
    setDeleteError('');
  };

  // Cancel deletion
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setFileToDelete(null);
    setDeleteError('');
  };
  
  // File renaming
  const handleRenameFile = async (file: FileObject, newName: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      // Update in database
      const { error } = await supabase
        .from('audio_files')
        .update({ file_name: newName }) // Use file_name instead of name
        .eq('id', file.id)
        .eq('user_id', user.id);
      
      if (error) {
        throw error;
      }
      
      // Update state
      dispatch({ type: 'RENAME_FILE', payload: { id: file.id, newName } });
      
      // Update selected file if it's the one being renamed
      if (selectedFile && selectedFile.id === file.id) {
        setSelectedFile({ ...selectedFile, name: newName, storage_name: newName });
      }
      
      console.log(`Successfully renamed file to ${newName}`);
      return true;
    } catch (error) {
      console.error('Unexpected error during rename:', error);
      return false;
    }
  };

  // Handle file selection for details panel
  const handleFileSelect = (file: FileObject) => {
    setSelectedFile(file);
  };

  // Close file details panel
  const handleCloseFileDetails = () => {
    setSelectedFile(null);
  };
  
  // Toggle sort direction or set new sort field
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Process files: Filter and sort
  const processedFiles = fileState.files
    .filter(file => file.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      // Handle sorting
      if (sortField === 'name') {
        return sortDirection === 'asc' 
          ? a.name.localeCompare(b.name) 
          : b.name.localeCompare(a.name);
      } else if (sortField === 'size') {
        return sortDirection === 'asc' 
          ? a.size - b.size 
          : b.size - a.size;
      } else { // created_at
        return sortDirection === 'asc' 
          ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime() 
          : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    
  // Paginate files
  const paginatedFiles = processedFiles.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  // Calculate total pages
  const totalPages = Math.ceil(processedFiles.length / itemsPerPage);
  
  // Format duration from seconds to mm:ss
  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Unknown';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Calculate days until expiration (60 days from upload)
  const getDaysUntilExpiration = (createdAt: string) => {
    const uploadDate = new Date(createdAt);
    const expirationDate = new Date(uploadDate.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days in ms
    const now = new Date();
    const daysLeft = Math.ceil((expirationDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    return daysLeft;
  };

  // Status indicator component
  const StatusBadge = ({ status }: { status?: FileObject['status'] }) => {
    switch (status) {
      case 'ready':
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
            Ready
          </span>
        );
      case 'processing':
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400">
            Processing
          </span>
        );
      case 'transcribed':
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400">
            Transcribed
          </span>
        );
      case 'error':
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">
            Error
          </span>
        );
      default:
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-400">
            Unknown
          </span>
        );
    }
  };
  
  // Determine what content to show based on state
  const renderContent = () => {
    // If there's an error, show error message
    if (fileState.error) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-8 w-8 text-red-500 mb-4" />
          <p className="text-red-500 dark:text-red-400 text-center">{fileState.error}</p>
          <button
            onClick={handleManualRefresh}
            className="mt-4 inline-flex items-center justify-center py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      );
    }
    
    // If we're loading (only on first load) and don't have files yet, show loading spinner
    if (fileState.isLoading && !fileState.hasBeenFetched) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading your files...</p>
        </div>
      );
    }
    
    // If we have files, show them
    if (processedFiles.length > 0) {
      return (
        <div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th 
                    scope="col" 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      File Name
                      {sortField === 'name' && (
                        sortDirection === 'asc' ? 
                          <SortAsc className="h-4 w-4 ml-1" /> : 
                          <SortDesc className="h-4 w-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('size')}
                  >
                    <div className="flex items-center">
                      Size
                      {sortField === 'size' && (
                        sortDirection === 'asc' ? 
                          <SortAsc className="h-4 w-4 ml-1" /> : 
                          <SortDesc className="h-4 w-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Duration
                  </th>
                  <th 
                    scope="col" 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center">
                      Uploaded
                      {sortField === 'created_at' && (
                        sortDirection === 'asc' ? 
                          <SortAsc className="h-4 w-4 ml-1" /> : 
                          <SortDesc className="h-4 w-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Expires In
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedFiles.map((file) => {
                  const daysLeft = getDaysUntilExpiration(file.created_at);
                  
                  return (
                    <tr key={file.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div 
                          className="flex items-center cursor-pointer"
                          onClick={() => handleFileSelect(file)}
                        >
                          <FileAudio className="h-5 w-5 text-gray-400 mr-3" />
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400">
                            {file.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatFileSize(file.size)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDuration(file.duration)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(file.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <StatusBadge status={file.status} />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {daysLeft <= 0 ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">
                            Expired
                          </span>
                        ) : daysLeft <= 7 ? (
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 text-amber-500 mr-1" />
                            <span className="text-sm text-amber-500">
                              {daysLeft} days
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {daysLeft} days
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                          onClick={() => promptDeleteFile(file)}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-4 py-3 sm:px-6 mt-4">
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(currentPage * itemsPerPage, processedFiles.length)}
                    </span>{' '}
                    of <span className="font-medium">{processedFiles.length}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    
                    {Array.from({ length: Math.min(5, totalPages) }).map((_, idx) => {
                      // Logic to show a window of 5 pages around current page
                      let pageNum = currentPage;
                      if (totalPages <= 5) {
                        pageNum = idx + 1;
                      } else if (currentPage <= 3) {
                        pageNum = idx + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + idx;
                      } else {
                        pageNum = currentPage - 2 + idx;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border ${
                            currentPage === pageNum 
                              ? 'z-10 bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-600 text-blue-600 dark:text-blue-400' 
                              : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                          } text-sm font-medium`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </nav>
                </div>
              </div>
              
              {/* Mobile pagination */}
              <div className="flex items-center justify-between w-full sm:hidden">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }
    
    // No files - either empty state or search not matching
    return (
      <div className="flex flex-col items-center justify-center py-12">
        {searchTerm ? (
          <>
            <Search className="h-8 w-8 text-gray-400 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 text-center">No files match your search.</p>
            <button
              onClick={() => setSearchTerm('')}
              className="mt-4 inline-flex items-center justify-center py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium"
            >
              Clear Search
            </button>
          </>
        ) : (
          <>
            <FileAudio className="h-8 w-8 text-gray-400 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 text-center">
              You don't have any audio files yet.
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-center mt-2">
              Upload an audio file to get started.
            </p>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Header with search */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Your Files</h2>
          
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full sm:w-64 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sm"
              />
            </div>
            
            {/* Refresh Button */}
            <button 
              onClick={handleManualRefresh}
              className="inline-flex items-center justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && fileToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Confirm Deletion</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Are you sure you want to delete <span className="font-semibold">{fileToDelete.name}</span>? This action cannot be undone.
            </p>
            
            {deleteError && (
              <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 p-3 rounded-md mb-4">
                {deleteError}
              </div>
            )}
            
            <div className="flex justify-end gap-3">
              <button
                onClick={cancelDelete}
                disabled={isDeleting}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteFile}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium flex items-center"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* File Details Panel */}
      <FileDetailsPanel 
        file={selectedFile} 
        onClose={handleCloseFileDetails}
        onDelete={promptDeleteFile}
        onRename={handleRenameFile}
      />
      
      {/* Main Content Area */}
      <div className="p-4">
        {renderContent()}
      </div>
    </div>
  );
} 