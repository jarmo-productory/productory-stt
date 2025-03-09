import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload,
  FileAudio,
  Plus,
  X,
  Check,
  XCircle,
  Ban,
  Loader2,
  AlertCircle,
  FileWarning,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// Import shared types and utilities
import { SelectedFile } from '../utils/types';
import { 
  formatFileSize, 
  validateFile,
  generateFormattedFilename,
  extractAudioDuration,
  saveAudioMetadata
} from '../utils/fileHelpers';
import { storagePathUtil } from '@/lib/utils/storage';

interface FileUploadProps {
  onUploadComplete: () => void;
  onUploadStart: () => void;
}

export function FileUpload({ onUploadComplete, onUploadStart }: FileUploadProps) {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [uploadAreaExpanded, setUploadAreaExpanded] = useState(true);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection with validation
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    console.log("File selection event triggered");
    
    if (e.target.files) {
      const fileList = e.target.files;
      console.log(`${fileList.length} files selected from file browser`);
      
      const newFiles = Array.from(fileList);
      
      // Debug log the file objects
      console.log('Selected files details:', newFiles.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        constructor: file.constructor.name,
        allProps: Object.getOwnPropertyNames(file)
      })));
      
      // Validate and prepare files
      const validatedFiles = newFiles.map(file => {
        const validation = validateFile(file);
        console.log(`Validating file ${file.name}:`, validation);
        
        // Create a tracking object that references the original file
        // instead of trying to recreate a File object
        return {
          file: file, // Keep reference to the original File object
          name: file.name,
          size: file.size,
          type: file.type,
          status: validation.valid ? 'queued' : 'error',
          validationErrors: validation.errors,
          uploadProgress: 0
        } as SelectedFile;
      });
      
      if (validatedFiles.length > 0) {
        console.log(`Adding ${validatedFiles.length} files to the selection`);
        setSelectedFiles(prevFiles => [...prevFiles, ...validatedFiles]);
        
        // Check if we have invalid files and show an error
        const invalidFiles = validatedFiles.filter(file => file.status === 'error');
        if (invalidFiles.length > 0) {
          setErrorMessage(`${invalidFiles.length} file(s) cannot be uploaded due to validation errors.`);
        } else {
          setErrorMessage('');
        }
      }
    } else {
      console.log("No files were selected");
    }
    
    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    console.log("File drop event triggered");
    
    if (e.dataTransfer.files.length > 0) {
      const fileList = e.dataTransfer.files;
      console.log(`${fileList.length} files dropped`);
      
      const newFiles = Array.from(fileList);
      
      // Debug log the file objects
      console.log('Dropped files details:', newFiles.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        constructor: file.constructor.name,
        allProps: Object.getOwnPropertyNames(file)
      })));
      
      // Validate and prepare files
      const validatedFiles = newFiles.map(file => {
        const validation = validateFile(file);
        console.log(`Validating dropped file ${file.name}:`, validation);
        
        // Create a tracking object that references the original file
        return {
          file: file, // Keep reference to the original File object
          name: file.name,
          size: file.size,
          type: file.type,
          status: validation.valid ? 'queued' : 'error',
          validationErrors: validation.errors,
          uploadProgress: 0
        } as SelectedFile;
      });
      
      console.log(`Adding ${validatedFiles.length} dropped files to the selection`);
      setSelectedFiles(prevFiles => [...prevFiles, ...validatedFiles]);
      
      // Check if we have invalid files and show an error
      const invalidFiles = validatedFiles.filter(file => file.status === 'error');
      if (invalidFiles.length > 0) {
        setErrorMessage(`${invalidFiles.length} file(s) cannot be uploaded due to validation errors.`);
      } else {
        setErrorMessage('');
      }
    } else {
      console.log("No files were dropped");
    }
  };

  // Handle drag events with active state
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  // Remove a file from the selected files
  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prevFiles => {
      const updatedFiles = [...prevFiles];
      
      // If file is uploading, cancel the upload
      if (updatedFiles[index].status === 'uploading' && updatedFiles[index].cancelUpload) {
        updatedFiles[index].cancelUpload();
      }
      
      return updatedFiles.filter((_, i) => i !== index);
    });
    
    // Clear error message if no more files with errors
    if (selectedFiles.filter(file => file.status === 'error').length <= 1) {
      setErrorMessage('');
    }
  };

  // Clear all selected files
  const clearSelectedFiles = () => {
    // Cancel any ongoing uploads
    selectedFiles.forEach(file => {
      if (file.status === 'uploading' && file.cancelUpload) {
        file.cancelUpload();
      }
    });
    
    setSelectedFiles([]);
    setErrorMessage('');
  };

  // Toggle upload area expansion
  const toggleUploadArea = () => {
    setUploadAreaExpanded(!uploadAreaExpanded);
  };

  // Handle the upload process
  const handleUpload = async () => {
    console.log('===== UPLOAD PROCESS STARTED =====');
    console.log(`Total files in queue: ${selectedFiles.length}`);
    
    // Set uploading state
    setIsUploading(true);
    
    // Clear any existing messages
    setErrorMessage('');
    setSuccessMessage('');
    setShowSuccessMessage(false);
    
    // Notify parent component
    if (onUploadStart) {
      console.log('Notifying parent component of upload start');
      onUploadStart();
    }
    
    // Get session for user authentication
    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      console.error('No active session found, user not authenticated');
      setErrorMessage('You must be logged in to upload files.');
      setIsUploading(false);
      return;
    }
    console.log('User authenticated, proceeding with upload');
    
    // Filter out files that have validation errors
    const filesToUpload = selectedFiles.filter(file => file.status !== 'error');
    console.log(`Files ready for upload: ${filesToUpload.length}/${selectedFiles.length}`);
    
    if (filesToUpload.length === 0) {
      console.log('No valid files to upload, aborting process');
      setErrorMessage('No valid files to upload.');
      setIsUploading(false);
      return;
    }
    
    // Create a copy of the files array to update the progress
    const updatedFiles = [...selectedFiles];
    let successCount = 0;
    let errorCount = 0;
    
    // Process each file
    await Promise.all(
      filesToUpload.map(async (selectedFile, index) => {
        console.log(`Processing file: ${selectedFile.name} (${formatFileSize(selectedFile.size)})`);
        
        // Find the index of the file in the updatedFiles array
        const fileIndex = updatedFiles.findIndex(f => f.name === selectedFile.name && f.size === selectedFile.size);
        if (fileIndex === -1) {
          console.error(`Cannot find file ${selectedFile.name} in the updatedFiles array`);
          return;
        }
        
        // Update file status to uploading
        updatedFiles[fileIndex] = {
          ...updatedFiles[fileIndex],
          status: 'uploading',
          uploadProgress: 0
        };
        
        // Update the state to show uploading status
        setSelectedFiles([...updatedFiles]);
        
        try {
          console.log(`Starting upload of ${selectedFile.name} to Supabase Storage`);
          
          // Get the actual File object from our wrapper
          const file = selectedFile.file;
          
          // Verify we have a proper File object
          if (!file || !(file instanceof File)) {
            console.error(`${selectedFile.name} is not a valid File object`, file);
            throw new Error(`${selectedFile.name} is not a valid File object`);
          }
          
          // Log the actual file being used for upload
          console.log('Using original File object for upload:', {
            isFile: file instanceof File,
            size: file.size,
            type: file.type,
            name: file.name
          });
          
          // Create a unique path for the file
          const userId = session.data.session?.user.id;
          if (!userId) {
            console.error('User ID not found in session');
            throw new Error('Authentication error: User ID not available');
          }
          
          // Generate formatted filename with original name, timestamp, and random string
          const formattedFilename = generateFormattedFilename(file.name);
          const filePath = storagePathUtil.getAudioPath(userId, formattedFilename);
          console.log(`File path in storage: ${filePath}`);
          
          // Extract audio duration before upload
          console.log('Extracting audio duration...');
          let audioDuration: number | null = null;
          try {
            // Add a check for file size before attempting to extract duration
            if (file.size > 100 * 1024 * 1024) { // 100MB
              console.log('Skipping duration extraction for large file');
              audioDuration = null;
            } else {
              // Use a timeout to prevent hanging on problematic files
              const extractionPromise = extractAudioDuration(file);
              const timeoutPromise = new Promise<null>((resolve) => {
                setTimeout(() => {
                  console.log('Duration extraction timed out');
                  resolve(null);
                }, 5000); // 5 second timeout
              });
              
              audioDuration = await Promise.race([extractionPromise, timeoutPromise]);
              if (audioDuration !== null) {
                console.log(`Extracted duration: ${audioDuration} seconds`);
              } else {
                console.log('Extracted duration: unavailable (using an unsupported codec or format)');
              }
            }
          } catch (durationError) {
            console.warn('Failed to extract audio duration - continuing upload anyway:', durationError);
            // Continue with upload even if duration extraction fails
            audioDuration = null;
          }
          
          // We can still proceed with the upload even without duration
          console.log('Proceeding with upload' + (audioDuration === null ? ' without duration information' : ''));
          
          // We'll use Supabase's direct upload but track progress with our own events
          // This ensures we get proper progress tracking while still using Supabase's API
          let uploadProgress = 0;
          
          // Setup progress tracker
          const trackProgress = (progress: number) => {
            // Only update if progress has meaningfully changed (avoids too many renders)
            if (progress > uploadProgress + 2 || progress === 100) {
              uploadProgress = progress;
              console.log(`Upload progress for ${selectedFile.name}: ${progress}%`);
              
              // Update the progress in the UI
              const progressUpdatedFiles = [...updatedFiles];
              if (progressUpdatedFiles[fileIndex]) {
                progressUpdatedFiles[fileIndex] = {
                  ...progressUpdatedFiles[fileIndex], 
                  uploadProgress: progress
                };
                setSelectedFiles([...progressUpdatedFiles]);
              }
            }
          };
          
          // Set initial progress indicator
          trackProgress(1);
          
          // Upload to Supabase with progress tracking
          const uploadUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${storagePathUtil.getBucketConfig().defaultBucket}/${filePath}`;
          
          // Create form data with the file
          const formData = new FormData();
          formData.append('file', file);
          
          // Create fetch request with progress tracking
          const xhr = new XMLHttpRequest();
          xhr.open('POST', uploadUrl, true);
          
          // Add headers needed for Supabase
          xhr.setRequestHeader('Authorization', `Bearer ${session.data.session?.access_token}`);
          xhr.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
          xhr.setRequestHeader('x-upsert', 'false'); // Don't overwrite existing files
          
          // Setup progress tracking
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100);
              trackProgress(progress);
            }
          };
          
          // Execute the upload and wait for completion
          const uploadResult = await new Promise<{data: any, error: any}>((resolve, reject) => {
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                // Success
                trackProgress(100);
                try {
                  const data = JSON.parse(xhr.responseText);
                  resolve({ data, error: null });
                } catch (e) {
                  resolve({ data: { path: filePath }, error: null });
                }
              } else {
                // Error
                let errorMessage = 'Upload failed';
                try {
                  const response = JSON.parse(xhr.responseText);
                  errorMessage = response.error || 'Server error during upload';
                } catch (e) {
                  errorMessage = `HTTP error ${xhr.status}`;
                }
                reject(new Error(errorMessage));
              }
            };
            
            xhr.onerror = () => reject(new Error('Network error during upload'));
            xhr.ontimeout = () => reject(new Error('Upload timed out'));
            
            // Send the upload request
            xhr.send(formData);
          });
          
          // Process the result
          if (uploadResult.error) {
            console.error(`Error uploading file ${selectedFile.name}:`, uploadResult.error);
            
            // Update file status to error
            updatedFiles[fileIndex] = {
              ...updatedFiles[fileIndex],
              status: 'error',
              errorMessage: `Upload failed: ${uploadResult.error.message || 'Unknown error'}`
            };
            
            errorCount++;
          } else {
            console.log(`File ${selectedFile.name} uploaded successfully:`, uploadResult.data);
            
            // Save metadata to the audio_files table
            console.log('Saving audio metadata to database...');
            const fileExtension = formattedFilename.split('.').pop()?.toLowerCase() || '';
            
            await saveAudioMetadata(
              userId,
              formattedFilename,
              filePath,
              file.size,
              audioDuration,
              fileExtension,
              'ready',
              file.name
            );
            
            // Set to 100% on success
            updatedFiles[fileIndex] = {
              ...updatedFiles[fileIndex],
              status: 'success',
              uploadProgress: 100
            };
            
            successCount++;
          }
        } catch (error) {
          console.error(`Exception during upload of ${selectedFile.name}:`, error);
          
          // Update file status to error
          updatedFiles[fileIndex] = {
            ...updatedFiles[fileIndex],
            status: 'error',
            errorMessage: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
          
          errorCount++;
        }
        
        // Update the state with the latest file status
        setSelectedFiles([...updatedFiles]);
      })
    );
    
    console.log(`===== UPLOAD PROCESS COMPLETED =====`);
    console.log(`Summary: ${successCount} successful, ${errorCount} failed`);
    
    // Set uploading state to false
    setIsUploading(false);
    
    // Show success message if any files were uploaded successfully
    if (successCount > 0) {
      const message = `Successfully uploaded ${successCount} file${successCount > 1 ? 's' : ''}.`;
      setSuccessMessage(message);
      setShowSuccessMessage(true);
      
      // Auto-dismiss success message after 5 seconds
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 5000);
      
      console.log('Upload completed successfully, clearing all files');
      // Clear all files completely after successful upload
      setSelectedFiles([]);
    }
    
    // Show error message if any files failed to upload
    if (errorCount > 0) {
      setErrorMessage(`${errorCount} file${errorCount > 1 ? 's' : ''} failed to upload. Check the file list for details.`);
    }
    
    // Notify parent component of upload completion but don't show duplicated success message
    if (onUploadComplete) {
      console.log('Notifying parent component of upload completion');
      onUploadComplete();
    }
  };

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
      {/* Upload Area Header */}
      <div 
        className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center cursor-pointer"
        onClick={toggleUploadArea}
      >
        <div className="flex items-center">
          <Upload className="h-5 w-5 text-blue-500 mr-2" />
          <h2 className="text-lg font-semibold">Upload Audio Files</h2>
        </div>
        <button className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          {uploadAreaExpanded ? (
            <X className="h-5 w-5" />
          ) : (
            <Plus className="h-5 w-5" />
          )}
        </button>
      </div>
      
      {/* Expandable Content */}
      <AnimatePresence>
        {uploadAreaExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {/* Status Notifications */}
            <div className="px-6 pt-6">
              {/* Success Message */}
              <AnimatePresence>
                {showSuccessMessage && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/30 rounded-lg flex items-start shadow-sm"
                  >
                    <div className="mr-3 flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-800/30 rounded-full flex items-center justify-center">
                      <Check className="h-5 w-5 text-green-500 dark:text-green-400" />
                    </div>
                    <div className="flex-grow">
                      <h4 className="font-medium text-green-800 dark:text-green-300">Upload Complete</h4>
                      <p className="text-sm text-green-600 dark:text-green-400">{successMessage}</p>
                    </div>
                    <button 
                      onClick={() => setShowSuccessMessage(false)}
                      className="p-1 text-green-500 hover:text-green-700 dark:hover:text-green-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error Message */}
              <AnimatePresence>
                {errorMessage && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`mb-4 p-4 ${
                      errorMessage.includes('decode audio data') 
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/30'
                        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30'
                    } rounded-lg flex items-start shadow-sm`}
                  >
                    <div className={`mr-3 flex-shrink-0 w-8 h-8 ${
                      errorMessage.includes('decode audio data')
                        ? 'bg-yellow-100 dark:bg-yellow-800/30 rounded-full'
                        : 'bg-red-100 dark:bg-red-800/30 rounded-full'
                      } flex items-center justify-center`}
                    >
                      <AlertCircle className={`h-5 w-5 ${
                        errorMessage.includes('decode audio data')
                          ? 'text-yellow-500 dark:text-yellow-400'
                          : 'text-red-500 dark:text-red-400'
                      }`} />
                    </div>
                    <div className="flex-grow">
                      <h4 className={`font-medium ${
                        errorMessage.includes('decode audio data')
                          ? 'text-yellow-800 dark:text-yellow-300'
                          : 'text-red-800 dark:text-red-300'
                      }`}>
                        {errorMessage.includes('decode audio data') ? 'Upload Note' : 'Upload Error'}
                      </h4>
                      <p className={`text-sm ${
                        errorMessage.includes('decode audio data')
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {errorMessage.includes('decode audio data')
                          ? 'Unable to extract duration information from this audio format. The file will still be uploaded successfully.'
                          : errorMessage
                        }
                      </p>
                    </div>
                    <button 
                      onClick={() => setErrorMessage('')}
                      className={`p-1 ${
                        errorMessage.includes('decode audio data')
                          ? 'text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-300'
                          : 'text-red-500 hover:text-red-700 dark:hover:text-red-300'
                      }`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Upload Area */}
            <div 
              className={`px-6 pb-6 ${dragActive ? 'bg-blue-50 dark:bg-gray-700' : ''}`}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* Drag & Drop Zone */}
              <div className={`
                border-2 border-dashed rounded-lg p-8 text-center
                ${dragActive 
                  ? 'border-blue-500 bg-blue-50 dark:bg-gray-700' 
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400'
                }
                transition-colors duration-200
              `}>
                <div className="flex flex-col items-center">
                  <FileAudio className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-3" />
                  <h3 className="text-lg font-medium mb-1">Drag & Drop Your Audio Files</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Or click to browse your device
                  </p>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded transition-colors duration-200"
                  >
                    Select Files
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden" 
                    multiple 
                    accept=".wav,.mp3,.m4a,.flac,audio/wav,audio/x-wav,audio/mpeg,audio/mp3,audio/m4a,audio/x-m4a,audio/mp4,audio/flac,audio/x-flac"
                    onChange={handleFileSelect}
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
                    Supported formats: WAV, MP3, M4A, FLAC. Maximum size: 500MB
                  </p>
                </div>
              </div>
              
              {/* Selected Files List */}
              {selectedFiles.length > 0 && (
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-medium">Selected Files</h3>
                    <button 
                      onClick={clearSelectedFiles}
                      className="text-sm text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 flex items-center"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Clear All
                    </button>
                  </div>
                  
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                    {selectedFiles.map((file, index) => (
                      <div 
                        key={index} 
                        className={`
                          p-3 rounded-lg border flex items-center justify-between
                          ${file.status === 'error' 
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/30' 
                            : file.status === 'success'
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/30'
                              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                          }
                        `}
                      >
                        <div className="flex items-center overflow-hidden">
                          <FileAudio className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-3 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{file.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatFileSize(file.size)}
                            </p>
                            
                            {/* Validation Errors */}
                            {file.validationErrors && file.validationErrors.length > 0 && (
                              <div className="mt-1">
                                {file.validationErrors.map((error, i) => (
                                  <p key={i} className="text-xs text-red-500 dark:text-red-400 flex items-center">
                                    <Ban className="h-3 w-3 mr-1 flex-shrink-0" />
                                    {error}
                                  </p>
                                ))}
                              </div>
                            )}
                            
                            {/* Error Message */}
                            {file.status === 'error' && file.errorMessage && (
                              <p className="text-xs text-red-500 dark:text-red-400 mt-1 flex items-center">
                                <FileWarning className="h-3 w-3 mr-1 flex-shrink-0" />
                                {file.errorMessage}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center ml-4">
                          {/* Upload Progress */}
                          {file.status === 'uploading' && (
                            <div className="w-32 mr-3">
                              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-500 dark:bg-blue-600 transition-all duration-300 ease-out"
                                  style={{ 
                                    width: `${file.uploadProgress}%`,
                                    transition: 'width 0.3s ease-in-out'
                                  }}
                                ></div>
                              </div>
                              <div className="flex justify-between items-center mt-1">
                                <div className="flex items-center">
                                  <Loader2 className="h-3 w-3 text-blue-500 dark:text-blue-400 animate-spin mr-1" />
                                  <span className="text-xs text-blue-600 dark:text-blue-400">Uploading</span>
                                </div>
                                <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                  {file.uploadProgress}%
                                </p>
                              </div>
                            </div>
                          )}
                          
                          {/* Success Icon */}
                          {file.status === 'success' && (
                            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mr-2">
                              <Check className="h-4 w-4 text-green-500 dark:text-green-400" />
                            </div>
                          )}
                          
                          {/* Remove Button */}
                          {file.status !== 'success' && (
                            <button 
                              onClick={() => removeSelectedFile(index)}
                              className={`
                                w-8 h-8 rounded-full flex items-center justify-center
                                ${file.status === 'error' 
                                  ? 'text-red-500 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30' 
                                  : 'text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-700'
                                }
                              `}
                              aria-label="Remove file"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Upload Button */}
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={handleUpload}
                      disabled={isUploading || selectedFiles.every(file => file.status === 'error')}
                      className={`
                        flex items-center py-2 px-4 rounded transition-colors duration-200
                        ${isUploading || selectedFiles.every(file => file.status === 'error')
                          ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                        }
                      `}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Files
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 