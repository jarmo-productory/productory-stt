/**
 * Helper functions for storage operations using the StoragePathUtil
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { storagePathUtil, StorageError } from './storage';

/**
 * Result of a storage operation
 */
export interface StorageResult<T> {
  data: T | null;
  error: Error | null;
  success: boolean;
}

/**
 * Upload a file to storage with consistent error handling
 * @param supabase Supabase client
 * @param file File to upload
 * @param userId User ID
 * @param options Upload options
 * @returns Result of the upload operation
 */
export async function uploadFile(
  supabase: SupabaseClient,
  file: File,
  userId: string,
  options: {
    cacheControl?: string;
    upsert?: boolean;
    onProgress?: (progress: number) => void;
  } = {}
): Promise<StorageResult<{ path: string; url: string }>> {
  try {
    // Generate a formatted filename
    const formattedFilename = storagePathUtil.generateFormattedFilename(file.name);
    
    // Get the storage path for the file
    const filePath = storagePathUtil.getAudioPath(userId, formattedFilename);
    
    // Get the bucket name from the configuration
    const bucketName = storagePathUtil.getBucketConfig().defaultBucket;
    
    // Upload to Supabase
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: options.cacheControl || '3600',
        upsert: options.upsert || false,
      });
    
    if (error) {
      throw error;
    }
    
    // Get the public URL for the file
    const url = storagePathUtil.getPublicUrl(filePath);
    
    return {
      data: { path: filePath, url },
      error: null,
      success: true
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error uploading file'),
      success: false
    };
  }
}

/**
 * Download a file from storage with consistent error handling
 * @param supabase Supabase client
 * @param filePath Path to the file
 * @param options Download options
 * @returns Result of the download operation
 */
export async function downloadFile(
  supabase: SupabaseClient,
  filePath: string,
  options: {
    transform?: {
      width?: number;
      height?: number;
      resize?: 'cover' | 'contain' | 'fill';
    };
  } = {}
): Promise<StorageResult<Blob>> {
  try {
    // Ensure the path follows the standard format
    const normalizedPath = storagePathUtil.isStandardPath(filePath)
      ? filePath
      : storagePathUtil.normalizePath(filePath);
    
    // Get the bucket name from the configuration
    const bucketName = storagePathUtil.getBucketConfig().defaultBucket;
    
    // Use retry logic for the download operation
    const { data, error } = await storagePathUtil.withRetry(async () => {
      return await supabase.storage
        .from(bucketName)
        .download(normalizedPath, options);
    });
    
    if (error) {
      throw error;
    }
    
    if (!data) {
      throw new Error('No data returned from download operation');
    }
    
    return {
      data,
      error: null,
      success: true
    };
  } catch (error) {
    console.error('Error downloading file:', error);
    
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error downloading file'),
      success: false
    };
  }
}

/**
 * Get a public URL for a file with consistent error handling
 * @param filePath Path to the file
 * @param options URL options
 * @returns Result of the URL generation operation
 */
export function getFileUrl(
  filePath: string,
  options: {
    download?: boolean;
    bucket?: string;
  } = {}
): StorageResult<string> {
  try {
    // Ensure the path follows the standard format
    const normalizedPath = storagePathUtil.isStandardPath(filePath)
      ? filePath
      : storagePathUtil.normalizePath(filePath);
    
    // Get the URL based on the options
    const url = options.download
      ? storagePathUtil.getDownloadUrl(normalizedPath, options.bucket)
      : storagePathUtil.getPublicUrl(normalizedPath, options.bucket);
    
    return {
      data: url,
      error: null,
      success: true
    };
  } catch (error) {
    console.error('Error generating file URL:', error);
    
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error generating file URL'),
      success: false
    };
  }
}

/**
 * Delete a file from storage with consistent error handling
 * @param supabase Supabase client
 * @param filePath Path to the file
 * @returns Result of the delete operation
 */
export async function deleteFile(
  supabase: SupabaseClient,
  filePath: string
): Promise<StorageResult<void>> {
  try {
    // Ensure the path follows the standard format
    const normalizedPath = storagePathUtil.isStandardPath(filePath)
      ? filePath
      : storagePathUtil.normalizePath(filePath);
    
    // Get the bucket name from the configuration
    const bucketName = storagePathUtil.getBucketConfig().defaultBucket;
    
    // Delete the file
    const { error } = await supabase.storage
      .from(bucketName)
      .remove([normalizedPath]);
    
    if (error) {
      throw error;
    }
    
    return {
      data: undefined,
      error: null,
      success: true
    };
  } catch (error) {
    console.error('Error deleting file:', error);
    
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error deleting file'),
      success: false
    };
  }
}

/**
 * Get a user-friendly error message for a storage error
 * @param error The error to get a message for
 * @returns A user-friendly error message
 */
export function getStorageErrorMessage(error: unknown): string {
  return storagePathUtil.getUserFriendlyErrorMessage(error);
}

/**
 * Check if a file exists in storage
 * @param supabase Supabase client
 * @param filePath Path to the file
 * @returns Result of the check operation
 */
export async function fileExists(
  supabase: SupabaseClient,
  filePath: string
): Promise<StorageResult<boolean>> {
  try {
    // Ensure the path follows the standard format
    const normalizedPath = storagePathUtil.isStandardPath(filePath)
      ? filePath
      : storagePathUtil.normalizePath(filePath);
    
    // Get the bucket name from the configuration
    const bucketName = storagePathUtil.getBucketConfig().defaultBucket;
    
    // List files with the given path
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list(normalizedPath.split('/').slice(0, -1).join('/'), {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
      });
    
    if (error) {
      throw error;
    }
    
    // Check if the file exists in the list
    const fileName = normalizedPath.split('/').pop() || '';
    const exists = data?.some(item => item.name === fileName) || false;
    
    return {
      data: exists,
      error: null,
      success: true
    };
  } catch (error) {
    console.error('Error checking if file exists:', error);
    
    return {
      data: false,
      error: error instanceof Error ? error : new Error('Unknown error checking if file exists'),
      success: false
    };
  }
} 