'use client';

import { useState, useEffect } from 'react';
import { FileAudio, Calendar, Clock, HardDrive, FileType, AlertCircle, Save, X, Loader2, Pencil, CheckCircle } from 'lucide-react';
import { formatFileSize } from '../../utils/fileHelpers';

// Define the FileObject interface (should match the one in FileManager)
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

interface FileInfoProps {
  file: FileObject;
  onRename: (newName: string) => Promise<boolean>;
}

export default function FileInfo({ file, onRename }: FileInfoProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [optimisticFileName, setOptimisticFileName] = useState(file.name);
  
  // Update optimistic filename when file changes
  useEffect(() => {
    setOptimisticFileName(file.name);
  }, [file.name]);
  
  // Extract file extension and name
  const getFileNameAndExtension = (filename: string) => {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) return { name: filename, extension: '' };
    
    return {
      name: filename.substring(0, lastDotIndex),
      extension: filename.substring(lastDotIndex)
    };
  };

  const { name: fileNameWithoutExt, extension: fileExtension } = getFileNameAndExtension(optimisticFileName);
  const [editedName, setEditedName] = useState(fileNameWithoutExt);

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

  // Get file extension
  const getFileExtension = (filename: string) => {
    return filename.split('.').pop()?.toUpperCase() || 'UNKNOWN';
  };

  // Status badge component
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

  // Handle editing filename
  const startEditing = () => {
    setEditedName(fileNameWithoutExt);
    setIsEditing(true);
    setError('');
    setSuccess(false);
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
    setError('');
    setSuccess(false);
  };

  // Submit new filename
  const submitNewFilename = async () => {
    // Validate filename
    if (!editedName.trim()) {
      setError('Filename cannot be empty');
      return;
    }

    // Check for invalid characters
    const invalidChars = /[<>:"\/\\|?*\x00-\x1F]/g;
    if (invalidChars.test(editedName)) {
      setError('Filename contains invalid characters');
      return;
    }

    // Check if name is unchanged
    if (editedName.trim() === fileNameWithoutExt) {
      setIsEditing(false);
      return;
    }

    setIsProcessing(true);
    setError('');
    
    // Add extension back to the filename
    const fullNewName = editedName.trim() + fileExtension;
    
    // Optimistic update
    setOptimisticFileName(fullNewName);
    
    try {
      // Call the rename function
      const success = await onRename(fullNewName);
      
      if (success) {
        setSuccess(true);
        // Close edit mode after showing success briefly
        setTimeout(() => {
          setIsEditing(false);
          setSuccess(false);
        }, 1000);
      } else {
        // Revert optimistic update on failure
        setOptimisticFileName(file.name);
        setError('Failed to rename file. Please try again.');
      }
    } catch (err) {
      // Revert optimistic update on error
      setOptimisticFileName(file.name);
      setError('An error occurred while renaming the file');
      console.error('Rename error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const daysLeft = getDaysUntilExpiration(file.created_at);

  return (
    <div>
      <div className="flex items-start mb-6">
        <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mr-4 flex-shrink-0">
          <FileAudio className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          {isEditing ? (
            <div className="flex flex-col space-y-3">
              <div className="flex items-center">
                <Pencil className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Edit filename
                </span>
              </div>
              
              <div className="flex flex-col space-y-3">
                <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden bg-white dark:bg-gray-700">
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="block w-full px-3 py-2 border-0 focus:ring-0 text-gray-900 dark:text-white text-base"
                    placeholder="Enter filename"
                    disabled={isProcessing}
                    autoFocus
                  />
                  <div className="px-3 py-2 bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300 whitespace-nowrap">
                    {fileExtension}
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  {error && (
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  )}
                  {success && (
                    <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                      <CheckCircle className="h-4 w-4 mr-1.5" />
                      Renamed successfully
                    </div>
                  )}
                  {!error && !success && <div />}
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={cancelEditing}
                      disabled={isProcessing}
                      className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center"
                    >
                      <X className="h-4 w-4 mr-1.5" />
                      Cancel
                    </button>
                    <button
                      onClick={submitNewFilename}
                      disabled={isProcessing}
                      className="px-3 py-1.5 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-1.5" />
                          Save
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="group flex items-center cursor-pointer" onClick={startEditing}>
                <h3 
                  className="text-lg font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                  title="Click to edit filename"
                >
                  {fileNameWithoutExt}
                  <span className="text-gray-500 dark:text-gray-400">{fileExtension}</span>
                </h3>
                <Pencil className="h-4 w-4 ml-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="mt-1">
                <StatusBadge status={file.status} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-start">
          <HardDrive className="h-5 w-5 text-gray-400 mt-0.5 mr-3" />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Size</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{formatFileSize(file.size)}</p>
          </div>
        </div>

        <div className="flex items-start">
          <Clock className="h-5 w-5 text-gray-400 mt-0.5 mr-3" />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Duration</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{formatDuration(file.duration)}</p>
          </div>
        </div>

        <div className="flex items-start">
          <Calendar className="h-5 w-5 text-gray-400 mt-0.5 mr-3" />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Uploaded</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {new Date(file.created_at).toLocaleDateString()} at {new Date(file.created_at).toLocaleTimeString()}
            </p>
          </div>
        </div>

        <div className="flex items-start">
          <FileType className="h-5 w-5 text-gray-400 mt-0.5 mr-3" />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Format</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{getFileExtension(file.name)}</p>
          </div>
        </div>

        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-gray-400 mt-0.5 mr-3" />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Expires In</p>
            {daysLeft <= 0 ? (
              <p className="text-sm text-red-500">Expired</p>
            ) : daysLeft <= 7 ? (
              <p className="text-sm text-amber-500">{daysLeft} days</p>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">{daysLeft} days</p>
            )}
          </div>
        </div>

        {/* Storage Filename (if different) */}
        {file.storage_name && file.storage_name !== file.name && (
          <div className="flex items-start">
            <Save className="h-5 w-5 text-gray-400 mt-0.5 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Storage Name</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 break-all">{file.storage_name}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 