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
  const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
  const randomId = uuidv4().substring(0, 8);
  
  // Extract file extension
  const fileExtension = originalFilename.includes('.')
    ? '.' + originalFilename.split('.').pop()?.toLowerCase()
    : '';
  
  // Create a sanitized base name from the original filename
  // Remove extension, replace spaces and special chars with underscores
  const baseName = originalFilename
    .substring(0, originalFilename.lastIndexOf('.'))
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 30); // Limit length
  
  return `${baseName}_${timestamp}_${randomId}${fileExtension}`;
};

// Extract audio duration
const extractAudioDuration = async (file: File): Promise<number | null> => {
  return new Promise((resolve) => {
    try {
      const audio = new Audio();
      const objectUrl = URL.createObjectURL(file);
      
      audio.addEventListener('loadedmetadata', () => {
        URL.revokeObjectURL(objectUrl);
        resolve(audio.duration);
      });
      
      audio.addEventListener('error', () => {
        URL.revokeObjectURL(objectUrl);
        console.error('Error loading audio file for duration extraction');
        resolve(null);
      });
      
      audio.src = objectUrl;
    } catch (error) {
      console.error('Error extracting audio duration:', error);
      resolve(null);
    }
  });
};

interface FileUploadProps {
  folderId?: string | null;
  onUploadComplete?: () => void;
  onUploadStart?: () => void;
  className?: string;
}

export function FileUpload({
  folderId = null,
  onUploadComplete,
  onUploadStart,
  className = '',
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

  // Upload all valid files
  const uploadFiles = async () => {
    if (!user) {
      setErrorMessage('You must be logged in to upload files');
      return;
    }
    
    const validFiles = selectedFiles.filter(file => file.status === 'queued');
    
    if (validFiles.length === 0) {
      setErrorMessage('No valid files to upload');
      return;
    }
    
    setIsUploading(true);
    setErrorMessage('');
    
    if (onUploadStart) {
      onUploadStart();
    }
    
    // Log the folder ID for debugging
    console.log(`Uploading files to folder: ${folderId || 'root'}`);
    
    // Track completed uploads
    let completedUploads = 0;
    let successfulUploads = 0;
    
    // Process each file
    for (let i = 0; i < selectedFiles.length; i++) {
      const selectedFile = selectedFiles[i];
      
      // Skip files that are not queued
      if (selectedFile.status !== 'queued') {
        completedUploads++;
        continue;
      }
      
      // Update file status to uploading
      setSelectedFiles(prevFiles => {
        const newFiles = [...prevFiles];
        newFiles[i] = {
          ...newFiles[i],
          status: 'uploading',
          uploadProgress: 0
        };
        return newFiles;
      });
      
      try {
        // Generate a formatted filename for storage
        const formattedFilename = generateFormattedFilename(selectedFile.name);
        
        // Extract audio duration
        const duration = await extractAudioDuration(selectedFile.file);
        
        // Upload the file to Supabase Storage
        const { data, error } = await supabase.storage
          .from('audio-files')
          .upload(`${user.id}/${formattedFilename}`, selectedFile.file, {
            cacheControl: '3600',
            upsert: false
          });
        
        if (error) {
          throw error;
        }
        
        // Save file metadata to the database
        const { data: fileData, error: fileError } = await supabase
          .from('audio_files')
          .insert({
            user_id: user.id,
            file_name: selectedFile.name,
            file_path: formattedFilename,
            size: selectedFile.file.size,
            duration: duration || 0,
            status: 'ready',
            format: selectedFile.file.type.split('/')[1] || 'unknown',
            folder_id: folderId,
            metadata: {
              original_filename: selectedFile.name,
              mime_type: selectedFile.file.type
            }
          })
          .select();
        
        if (fileError) {
          throw fileError;
        }
        
        // Update file status to success
        setSelectedFiles(prevFiles => {
          const newFiles = [...prevFiles];
          newFiles[i] = {
            ...newFiles[i],
            status: 'success',
            uploadProgress: 100
          };
          return newFiles;
        });
        
        successfulUploads++;
      } catch (err: any) {
        console.error('Error uploading file:', err);
        
        // Update file status to error
        setSelectedFiles(prevFiles => {
          const newFiles = [...prevFiles];
          newFiles[i] = {
            ...newFiles[i],
            status: 'error',
            errorMessage: err.message || 'Upload failed'
          };
          return newFiles;
        });
      } finally {
        completedUploads++;
        
        // Check if all uploads are complete
        if (completedUploads === selectedFiles.length) {
          setIsUploading(false);
          
          if (successfulUploads > 0) {
            setSuccessMessage(`Successfully uploaded ${successfulUploads} file(s)`);
            setShowSuccessMessage(true);
            
            // Hide success message after 3 seconds
            setTimeout(() => {
              setShowSuccessMessage(false);
            }, 3000);
            
            // Clear successfully uploaded files
            setSelectedFiles(prevFiles => prevFiles.filter(file => file.status !== 'success'));
            
            // Refresh files list
            refreshFiles();
            
            if (onUploadComplete) {
              onUploadComplete();
            }
          }
        }
      }
    }
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
              
              {folderId && (
                <p className="mb-2 text-xs text-primary">
                  Files will be uploaded to the current folder
                </p>
              )}
              
              <div className="mt-2 text-xs text-muted-foreground">
                Supported formats: {SUPPORTED_FORMATS.join(', ')} (Max: 500MB)
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
