/**
 * Type definitions for the dashboard components
 */

/**
 * Extended File interface with additional properties for upload management
 */
export interface SelectedFile {
  // File reference
  file: File;
  // Metadata (copied from file for easy access)
  name: string;
  size: number;
  type: string;
  // Status tracking
  status: 'queued' | 'uploading' | 'success' | 'error';
  uploadProgress: number;
  errorMessage?: string;
  validationErrors?: string[];
  cancelUpload?: () => void;
}

/**
 * Result of file validation checks
 */
export interface FileValidationResult {
  valid: boolean;
  errors: string[];
} 