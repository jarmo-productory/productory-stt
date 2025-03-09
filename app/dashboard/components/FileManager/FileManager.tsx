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
import { useRouter } from 'next/navigation';

import { formatFileSize } from '../utils/fileHelpers';

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
  const router = useRouter();
  const [fileState, dispatch] = useReducer(fileReducer, {
    files: [],
    isLoading: true,
    error: null,
    lastFetchTime: null,
    hasBeenFetched: false
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [fileToDelete, setFileToDelete] = useState<FileObject | null>(null);
  
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
    
    try {
      const storageFileName = fileToDelete.storage_name || fileToDelete.name;
      console.log(`Attempting to delete file: ${storageFileName} (display name: ${fileToDelete.name})`);
      
      const { error } = await supabase
        .storage
        .from('audio-files')
        .remove([`audio/${user.id}/${storageFileName}`]);
      
      if (error) {
        console.error('Error deleting file:', error);
        // We successfully deleted from storage, so don't show an error
      }
      
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
    } catch (error) {
      console.error('Unexpected error during deletion:', error);
    } finally {
      setFileToDelete(null);
    }
  };

  // Prompt for file deletion
  const promptDeleteFile = (file: FileObject) => {
    setFileToDelete(file);
  };

  // Cancel deletion
  const cancelDelete = () => {
    setFileToDelete(null);
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
      
      console.log(`Successfully renamed file to ${newName}`);
      return true;
    } catch (error) {
      console.error('Unexpected error during rename:', error);
      return false;
    }
  };

  // Replace handleFileSelect with navigation to file details page
  const handleFileSelect = (file: FileObject) => {
    router.push(`/files/${file.id}`);
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
    .filter(file => file.name.toLowerCase().includes(searchQuery.toLowerCase()))
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
                          onClick={(e) => {
                            e.stopPropagation();
                            promptDeleteFile(file);
                          }}
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
        {searchQuery ? (
          <>
            <Search className="h-8 w-8 text-gray-400 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 text-center">No files match your search.</p>
            <button
              onClick={() => setSearchQuery('')}
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
      {/* Header with search and refresh */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <button
          onClick={handleManualRefresh}
          disabled={fileState.isLoading}
          className="inline-flex items-center justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {fileState.isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </button>
      </div>
      
      {/* Main content */}
      <div className="overflow-hidden">
        {renderContent()}
      </div>
      
      {/* Delete confirmation dialog */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
            </div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 sm:mx-0 sm:h-10 sm:w-10">
                    <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                      Delete File
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Are you sure you want to delete "{fileToDelete.name}"? This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleDeleteFile}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={cancelDelete}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 