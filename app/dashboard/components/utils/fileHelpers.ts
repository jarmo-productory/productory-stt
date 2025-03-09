import { FileValidationResult } from './types';
import { supabase } from '@/utils/supabase';
import { storagePathUtil } from '@/lib/utils/storage';

// Supported file formats
export const SUPPORTED_FORMATS = ['.wav', '.mp3', '.m4a', '.flac'];
export const SUPPORTED_MIME_TYPES = [
  'audio/wav', 'audio/x-wav', 
  'audio/mpeg', 'audio/mp3', 
  'audio/m4a', 'audio/x-m4a', 'audio/mp4',
  'audio/flac', 'audio/x-flac'
];
export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB in bytes

/**
 * Formats a file size in bytes to a human-readable string with appropriate units
 * @param bytes - File size in bytes
 * @returns Formatted string with size and unit (B, KB, MB, GB)
 */
export const formatFileSize = (bytes: number): string => {
  // Check for invalid input
  if (bytes === undefined || bytes === null || isNaN(bytes) || bytes < 0) {
    return 'Unknown size';
  }
  
  if (bytes < 1024) return bytes + ' B';
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  else return (bytes / 1073741824).toFixed(1) + ' GB';
};

/**
 * Validates if a file meets the required format and size constraints
 * @param file - The file to validate
 * @returns Object with validation result and any error messages
 */
export const validateFile = (file: File): FileValidationResult => {
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

/**
 * Generates a formatted filename for storage
 * @param originalFilename - The original filename
 * @returns A formatted filename with timestamp and random string
 */
export const generateFormattedFilename = (originalFilename: string): string => {
  return storagePathUtil.generateFormattedFilename(originalFilename);
};

// Extract audio duration using Web Audio API
export const extractAudioDuration = async (file: File): Promise<number | null> => {
  return new Promise((resolve) => {
    try {
      // Check file type and size first - don't attempt to decode very large files
      if (file.size > 100 * 1024 * 1024) { // 100MB
        console.warn('Skipping duration extraction for large file:', file.name);
        resolve(null);
        return;
      }
      
      // Create an audio context
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) {
        console.warn('AudioContext not supported in this browser');
        resolve(null);
        return;
      }
      
      const audioContext = new AudioContext();
      
      // Create a file reader to read the file as an ArrayBuffer
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          // Get the ArrayBuffer from the FileReader result
          const arrayBuffer = event.target?.result as ArrayBuffer;
          
          if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            console.warn('Empty audio buffer');
            resolve(null);
            return;
          }
          
          // Add a timeout to prevent hanging on problematic files
          const timeoutPromise = new Promise<null>((resolveTimeout) => {
            setTimeout(() => {
              console.warn('Audio decoding timed out');
              resolveTimeout(null);
            }, 5000); // 5 second timeout
          });
          
          // Try to decode with timeout
          try {
            const decodePromise = audioContext.decodeAudioData(arrayBuffer)
              .then(audioBuffer => {
                const durationSeconds = audioBuffer.duration;
                console.log(`Extracted audio duration: ${durationSeconds} seconds`);
                return durationSeconds;
              })
              .catch(error => {
                // Log as warning instead of error to prevent it from appearing as a red error in the UI
                console.warn('Could not extract audio duration - file may use an unsupported codec', {
                  fileName: file.name,
                  fileType: file.type,
                  fileSize: formatFileSize(file.size),
                  error: error.message || 'Unknown decoding error'
                });
                return null;
              });
            
            // Race between decoding and timeout
            const result = await Promise.race([decodePromise, timeoutPromise]);
            resolve(result);
          } catch (decodeError) {
            console.warn('Exception during audio decoding - continuing upload without duration', {
              fileName: file.name,
              fileType: file.type,
              error: decodeError
            });
            resolve(null);
          }
        } catch (error) {
          console.warn('Error processing ArrayBuffer - continuing upload without duration', {
            fileName: file.name,
            error: error
          });
          resolve(null);
        }
      };
      
      reader.onerror = () => {
        console.warn('Error reading file for duration extraction - continuing upload without duration', {
          fileName: file.name,
          fileSize: formatFileSize(file.size),
          fileType: file.type
        });
        resolve(null);
      };
      
      // Read the file as an ArrayBuffer
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.warn('Error extracting audio duration - continuing upload without duration', {
        fileName: file.name,
        error: error
      });
      resolve(null);
    }
  });
};

// Save audio metadata to the database
export const saveAudioMetadata = async (
  userId: string,
  fileName: string,
  filePath: string,
  fileSize: number,
  duration: number | null,
  format: string,
  status: string = 'ready',
  originalFilename: string = ''
) => {
  try {
    console.log(`Saving metadata: file=${fileName}, size=${fileSize}, duration=${duration || 'unknown'}`);
    
    // Create metadata object with additional info
    const metadata = {
      original_filename: originalFilename || fileName,
      duration_extraction_status: duration === null ? 'failed' : 'success',
      upload_timestamp: new Date().toISOString()
    };
    
    const { error } = await supabase.from('audio_files').insert({
      user_id: userId,
      file_name: fileName,
      file_path: filePath,
      size: fileSize,
      duration: duration, // This can be null, which is fine
      format: format,
      status: status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: metadata
    });
    
    if (error) {
      console.error('Error saving audio metadata:', error);
      return false;
    }
    
    console.log('Audio metadata saved successfully');
    return true;
  } catch (error) {
    console.error('Exception saving audio metadata:', error);
    return false;
  }
}; 