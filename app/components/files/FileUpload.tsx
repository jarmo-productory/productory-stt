'use client';

import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFiles } from '@/contexts/FileContext';
import { useSupabase } from '@/hooks/useSupabase';
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { storagePathUtil } from "@/lib/utils/storage";
import { Upload as TusUpload } from 'tus-js-client';

// Supported file formats
const SUPPORTED_FORMATS = ['.wav', '.mp3', '.m4a', '.flac'];
const SUPPORTED_MIME_TYPES = [
  'audio/wav', 'audio/x-wav', 
  'audio/mpeg', 'audio/mp3', 
  'audio/m4a', 'audio/x-m4a', 'audio/mp4',
  'audio/flac', 'audio/x-flac'
];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB in bytes

// Helper function to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Selected file interface
interface SelectedFile {
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'queued' | 'uploading' | 'success' | 'error';
  uploadProgress: number;
  errorMessage?: string;
  validationErrors?: string[];
  cancelUpload?: () => void;
}

// File validation result interface
interface FileValidationResult {
  valid: boolean;
  errors: string[];
}

// Validate file
const validateFile = (file: File): FileValidationResult => {
  const errors: string[] = [];
  
  // Check file format
  const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
  const fileType = file.type.toLowerCase();
  
  if (!SUPPORTED_FORMATS.includes(fileExtension) && !SUPPORTED_MIME_TYPES.includes(fileType)) {
    errors.push(`Invalid file format. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`);
  }
  
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    errors.push(`File size exceeds the 500MB limit. Current size: ${formatFileSize(file.size)}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// Generate formatted filename
const generateFormattedFilename = (originalFilename: string): string => {
  return storagePathUtil.generateFormattedFilename(originalFilename);
};

// Extract audio duration
const extractAudioDuration = async (file: File): Promise<number | null> => {
  // For large files or unsupported formats, skip duration extraction to avoid errors
  if (file.size > 100 * 1024 * 1024) { // Skip files larger than 100MB
    console.log(`Skipping duration extraction for large file: ${file.name} (${formatFileSize(file.size)})`);
    return null;
  }
  
  // Check if the file type is supported for audio playback
  const supportedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-m4a', 'audio/aac', 'audio/ogg'];
  if (!supportedTypes.includes(file.type)) {
    console.log(`Skipping duration extraction for unsupported file type: ${file.type}`);
    return null;
  }
  
  return new Promise((resolve) => {
    try {
      const audio = new Audio();
      const objectUrl = URL.createObjectURL(file);
      
      // Set a timeout to ensure the blob URL is revoked even if events don't fire
      const timeoutId = setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
        console.log('Revoked blob URL due to timeout');
        
        // Clean up audio element
        audio.src = '';
        audio.load();
        
        resolve(null);
      }, 3000); // 3 second timeout
      
      audio.addEventListener('loadedmetadata', () => {
        clearTimeout(timeoutId);
        const duration = audio.duration;
        
        // Revoke the blob URL immediately
        URL.revokeObjectURL(objectUrl);
        console.log('Revoked blob URL after loadedmetadata');
        
        // Clean up audio element
        audio.src = '';
        audio.load();
        
        resolve(duration);
      }, { once: true }); // Use once: true to ensure the event listener is removed after it fires
      
      audio.addEventListener('error', () => {
        clearTimeout(timeoutId);
        
        // Don't log the error to avoid console spam
        // Just silently handle it and return null
        
        // Revoke the blob URL immediately
        URL.revokeObjectURL(objectUrl);
        console.log('Revoked blob URL after error');
        
        // Clean up audio element
        audio.src = '';
        audio.load();
        
        resolve(null);
      }, { once: true }); // Use once: true to ensure the event listener is removed after it fires
      
      // Set the source last
      audio.src = objectUrl;
      audio.preload = 'metadata'; // Only load metadata, not the entire file
    } catch (error) {
      console.log('Error in duration extraction setup, skipping:', error);
      resolve(null);
    }
  });
};

interface FileUploadProps {
  folderId?: string | null;
  onUploadComplete?: () => void;
  onUploadStart?: () => void;
  className?: string;
  uploadContext?: string;
}

export function FileUpload({
  folderId = null,
  onUploadComplete,
  onUploadStart,
  className = '',
  uploadContext
}: FileUploadProps) {
  const { user } = useAuth();
  const supabase = useSupabase();
  const { refreshFiles } = useFiles();
  
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [uploadAreaExpanded, setUploadAreaExpanded] = useState(true);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add a flag to control whether to extract duration
  const EXTRACT_DURATION = false; // Set to false to skip duration extraction completely

  // Handle file selection with validation
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileList = e.target.files;
      
      const newFiles = Array.from(fileList);
      
      // Validate and prepare files
      const validatedFiles = newFiles.map(file => {
        const validation = validateFile(file);
        
        return {
          file: file,
          name: file.name,
          size: file.size,
          type: file.type,
          status: validation.valid ? 'queued' : 'error',
          validationErrors: validation.errors,
          uploadProgress: 0
        } as SelectedFile;
      });
      
      if (validatedFiles.length > 0) {
        setSelectedFiles(prevFiles => [...prevFiles, ...validatedFiles]);
        
        // Check if we have invalid files and show an error
        const invalidFiles = validatedFiles.filter(file => file.status === 'error');
        if (invalidFiles.length > 0) {
          setErrorMessage(`${invalidFiles.length} file(s) cannot be uploaded due to validation errors.`);
        } else {
          setErrorMessage('');
        }
      }
    }
    
    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle drag events
  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  // Handle drop event
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      
      // Validate and prepare files
      const validatedFiles = newFiles.map(file => {
        const validation = validateFile(file);
        
        return {
          file: file,
          name: file.name,
          size: file.size,
          type: file.type,
          status: validation.valid ? 'queued' : 'error',
          validationErrors: validation.errors,
          uploadProgress: 0
        } as SelectedFile;
      });
      
      if (validatedFiles.length > 0) {
        setSelectedFiles(prevFiles => [...prevFiles, ...validatedFiles]);
        
        // Check if we have invalid files and show an error
        const invalidFiles = validatedFiles.filter(file => file.status === 'error');
        if (invalidFiles.length > 0) {
          setErrorMessage(`${invalidFiles.length} file(s) cannot be uploaded due to validation errors.`);
        } else {
          setErrorMessage('');
        }
      }
    }
  };

  // Trigger file input click
  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Remove a file from the selection
  const removeFile = (index: number) => {
    setSelectedFiles(prevFiles => {
      const newFiles = [...prevFiles];
      
      // If the file is uploading, try to cancel the upload
      if (newFiles[index].status === 'uploading' && newFiles[index].cancelUpload) {
        newFiles[index].cancelUpload();
      }
      
      newFiles.splice(index, 1);
      return newFiles;
    });
    
    // Clear error message if no files are left
    if (selectedFiles.length <= 1) {
      setErrorMessage('');
    }
  };

  // Add a method to clear selected files
  const clearSelectedFiles = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Upload all valid files
  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return;
    
    console.log('Starting upload process for', selectedFiles.length, 'files');
    setIsUploading(true);
    
    if (onUploadStart) {
      onUploadStart();
    }
    
    let successCount = 0;
    
    for (let i = 0; i < selectedFiles.length; i++) {
      const fileObj = selectedFiles[i];
      
      // Skip files with errors
      if (fileObj.status === 'error') continue;
      
      // Update status to uploading
      setSelectedFiles(prev => {
        const updated = [...prev];
        updated[i] = { ...updated[i], status: 'uploading', uploadProgress: 0 };
        return updated;
      });
      
      try {
        console.log(`Processing file ${i+1}/${selectedFiles.length}: ${fileObj.name}`);
        
        // Extract audio duration only if enabled
        let duration = null;
        if (EXTRACT_DURATION) {
          try {
            duration = await extractAudioDuration(fileObj.file);
            if (duration) {
              console.log(`Extracted duration for ${fileObj.name}: ${duration} seconds`);
            } else {
              console.log(`Could not extract duration for ${fileObj.name}, using null`);
            }
          } catch (err) {
            console.warn(`Could not extract duration for ${fileObj.name}:`, err);
          }
        } else {
          console.log(`Duration extraction disabled, using null for ${fileObj.name}`);
        }
        
        // Generate a formatted filename
        const formattedFilename = generateFormattedFilename(fileObj.name);
        console.log(`Generated formatted filename: ${formattedFilename}`);
        
        // Construct the storage path
        const userId = user?.id;
        if (!userId) {
          throw new Error('User ID is required for upload');
        }
        
        // Get the audio path using the storage path utility
        const audioPath = storagePathUtil.getAudioPath(userId, formattedFilename);
        console.log(`Constructed audio path: ${audioPath}`);
        
        // Get the current session for authentication
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          throw new Error('Authentication session is required for upload');
        }
        
        // Create a cancellation controller
        const controller = new AbortController();
        
        // Add cancel function to the file object
        setSelectedFiles(prev => {
          const updated = [...prev];
          updated[i] = { 
            ...updated[i], 
            cancelUpload: () => controller.abort() 
          };
          return updated;
        });
        
        // Use standard upload for small files (< 6MB) or resumable upload for larger files
        if (fileObj.size < 6 * 1024 * 1024) {
          // Standard upload for small files
          const { data: storageData, error: storageError } = await supabase.storage
            .from('audio-files')
            .upload(audioPath, fileObj.file, {
              cacheControl: '3600',
              upsert: false
            });
          
          if (storageError) {
            throw storageError;
          }
          
          console.log(`File uploaded to storage: ${storageData.path}`);
        } else {
          // Resumable upload for larger files using TUS protocol
          await new Promise<void>((resolve, reject) => {
            // Get the Supabase URL from the config
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
            
            const upload = new TusUpload(fileObj.file, {
              endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
              retryDelays: [0, 3000, 5000, 10000, 20000],
              headers: {
                authorization: `Bearer ${session.access_token}`,
                'x-upsert': 'false', // Set to true if you want to overwrite existing files
              },
              uploadDataDuringCreation: true,
              removeFingerprintOnSuccess: true,
              metadata: {
                bucketName: 'audio-files',
                objectName: audioPath,
                contentType: fileObj.type,
                cacheControl: '3600',
              },
              chunkSize: 6 * 1024 * 1024, // 6MB chunks as recommended by Supabase
              onError: (error: Error) => {
                console.error(`Upload error for ${fileObj.name}:`, error);
                reject(error);
              },
              onProgress: (bytesUploaded: number, bytesTotal: number) => {
                const progress = Math.round((bytesUploaded / bytesTotal) * 100);
                console.log(`Upload progress for ${fileObj.name}: ${progress}%`);
                
                // Update progress in the UI
                setSelectedFiles(prev => {
                  const updated = [...prev];
                  updated[i] = { ...updated[i], uploadProgress: progress };
                  return updated;
                });
              },
              onSuccess: () => {
                console.log(`Upload completed for ${fileObj.name}`);
                resolve();
              }
            });
            
            // Check for previous uploads to resume
            upload.findPreviousUploads().then((previousUploads: any[]) => {
              if (previousUploads.length) {
                upload.resumeFromPreviousUpload(previousUploads[0]);
              }
              
              // Start the upload
              upload.start();
            });
            
            // Handle cancellation
            if (controller.signal) {
              controller.signal.addEventListener('abort', () => {
                upload.abort();
                reject(new Error('Upload cancelled'));
              });
            }
          });
          
          console.log(`File uploaded to storage: ${audioPath}`);
        }
        
        // Save metadata to database
        const { data: dbData, error: dbError } = await supabase
          .from('audio_files')
          .insert({
            user_id: userId,
            file_name: fileObj.name,
            file_path: formattedFilename,
            size: fileObj.size,
            duration: duration,
            status: 'ready',
            format: fileObj.type.split('/')[1],
            folder_id: folderId,
            metadata: {
              original_filename: fileObj.name,
              mime_type: fileObj.type
            }
          })
          .select();
        
        if (dbError) {
          throw dbError;
        }
        
        console.log(`File metadata saved to database:`, dbData);
        
        // Update status to success
        setSelectedFiles(prev => {
          const updated = [...prev];
          updated[i] = { ...updated[i], status: 'success' };
          return updated;
        });
        
        successCount++;
      } catch (err: any) {
        console.error(`Error uploading file ${fileObj.name}:`, err);
        
        // Update status to error
        setSelectedFiles(prev => {
          const updated = [...prev];
          updated[i] = { 
            ...updated[i], 
            status: 'error', 
            errorMessage: err.message || 'Upload failed' 
          };
          return updated;
        });
      }
    }
    
    // Show success message
    if (successCount > 0) {
      const message = successCount === 1 
        ? 'File uploaded successfully' 
        : `${successCount} files uploaded successfully`;
      
      setSuccessMessage(message);
      setShowSuccessMessage(true);
      
      // Hide success message after 5 seconds
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 5000);
      
      // Clear selected files after successful upload
      clearSelectedFiles();
      
      // Call onUploadComplete callback
      if (onUploadComplete) {
        console.log('Calling onUploadComplete callback');
        onUploadComplete();
      }
    }
    
    setIsUploading(false);
    console.log('Upload process completed');
  };

  return (
    <div className={`w-full ${className}`}>
      <Card className={`border-dashed ${dragActive ? 'border-primary' : 'border-border'} ${selectedFiles.length > 0 ? 'mb-4' : ''}`}>
        <CardContent className="p-0">
          <div
            className="p-6 cursor-pointer"
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={handleButtonClick}
          >
            <div className="flex flex-col items-center justify-center text-center">
              <div className="mb-4 rounded-full bg-primary/10 p-3">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              
              <h3 className="mb-1 text-lg font-medium">Upload Audio Files</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Drag and drop audio files or click to browse
              </p>
              
              <p className="mb-2 text-xs text-primary">
                {uploadContext || (folderId ? "Files will be uploaded to the current folder" : "Files will be uploaded to your library")}
              </p>
              
              <div className="mt-2 text-xs text-muted-foreground">
                Supported formats: {SUPPORTED_FORMATS.join(', ')} (Max: {formatFileSize(MAX_FILE_SIZE)})
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={SUPPORTED_MIME_TYPES.join(',')}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>
          
          {/* Error Message */}
          {errorMessage && (
            <div className="border-t bg-destructive/10 p-3 text-center text-sm text-destructive">
              <AlertCircle className="mr-2 inline-block h-4 w-4" />
              {errorMessage}
            </div>
          )}
          
          {/* Success Message */}
          {showSuccessMessage && (
            <div className="border-t bg-green-50 p-3 text-center text-sm text-green-600">
              <Check className="mr-2 inline-block h-4 w-4" />
              {successMessage}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Selected Files - Moved above the action buttons */}
      {selectedFiles.length > 0 && (
        <Card className="mb-4 border">
          <CardContent className="p-4">
            <h4 className="mb-2 text-sm font-medium">Selected Files</h4>
            
            <div className="space-y-2">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-md border p-2 text-sm"
                >
                  <div className="flex items-center space-x-2 truncate">
                    <FileAudio className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {file.status === 'error' && (
                      <div className="flex items-center text-destructive">
                        <AlertCircle className="mr-1 h-4 w-4" />
                        <span className="text-xs">
                          {file.errorMessage || file.validationErrors?.[0] || 'Error'}
                        </span>
                      </div>
                    )}
                    
                    {file.status === 'uploading' && (
                      <div className="flex items-center">
                        <span className="mr-2 text-xs">{file.uploadProgress}%</span>
                        <div className="h-1.5 w-16 rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${file.uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {file.status === 'success' && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                    
                    {file.status !== 'success' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(index)}
                        disabled={isUploading && file.status === 'uploading'}
                        className="h-6 w-6"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Action Buttons - Now in a separate card with visual hierarchy */}
      <div className="flex flex-wrap gap-2 justify-center mt-6">
        {selectedFiles.length > 0 && (
          <Button
            variant="default"
            onClick={uploadFiles}
            disabled={isUploading || selectedFiles.every(file => file.status !== 'queued')}
            className="min-w-[120px]"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload {selectedFiles.filter(file => file.status === 'queued').length} {selectedFiles.filter(file => file.status === 'queued').length === 1 ? 'File' : 'Files'}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
