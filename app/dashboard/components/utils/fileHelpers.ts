import { FileValidationResult } from './types';

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