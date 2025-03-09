/**
 * Storage utility for consistent file path handling across the application.
 * This utility standardizes bucket naming and path structure for file storage operations.
 */

/**
 * Custom error types for storage operations
 */
export class StorageError extends Error {
  public code: string;
  public context: Record<string, any>;

  constructor(message: string, code: string, context: Record<string, any> = {}) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.context = context;
  }
}

export class PathConstructionError extends StorageError {
  constructor(message: string, context: Record<string, any> = {}) {
    super(message, 'PATH_CONSTRUCTION_ERROR', context);
    this.name = 'PathConstructionError';
  }
}

export class InvalidPathError extends StorageError {
  constructor(message: string, context: Record<string, any> = {}) {
    super(message, 'INVALID_PATH_ERROR', context);
    this.name = 'InvalidPathError';
  }
}

export class ConfigurationError extends StorageError {
  constructor(message: string, context: Record<string, any> = {}) {
    super(message, 'CONFIGURATION_ERROR', context);
    this.name = 'ConfigurationError';
  }
}

/**
 * User-friendly error messages for common error codes
 */
export const ERROR_MESSAGES = {
  PATH_CONSTRUCTION_ERROR: 'There was an issue constructing the file path. Please try again or contact support.',
  INVALID_PATH_ERROR: 'The file path is invalid or malformed. Please check the path and try again.',
  CONFIGURATION_ERROR: 'There is a configuration issue with the storage system. Please contact support.',
  MISSING_USER_ID: 'User ID is required for this operation. Please ensure you are logged in.',
  MISSING_FILE_NAME: 'File name is required for this operation. Please provide a valid file name.',
  INVALID_BUCKET_NAME: 'The specified bucket name is invalid. Please use a valid bucket name.',
  MISSING_BASE_URL: 'The storage base URL is not configured. Please check your environment configuration.',
};

/**
 * Configuration for the storage utility
 */
export interface StorageConfig {
  // Default bucket name used across the application
  defaultBucket: string;
  // Base URL for Supabase storage
  baseUrl: string;
  // Default path prefix for audio files
  audioPathPrefix: string;
  // Maximum number of retries for operations
  maxRetries?: number;
  // Delay between retries in milliseconds
  retryDelay?: number;
  // Whether to log operations
  enableLogging?: boolean;
}

/**
 * Storage utility for consistent file path handling
 */
export class StoragePathUtil {
  private config: StorageConfig;

  constructor(config?: Partial<StorageConfig>) {
    // Default configuration
    this.config = {
      defaultBucket: 'audio-files',
      baseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      audioPathPrefix: 'audio',
      maxRetries: 3,
      retryDelay: 500,
      enableLogging: true,
      ...config
    };

    // Validate configuration
    this.validateConfig();
  }

  /**
   * Validate the configuration
   * @private
   * @throws {ConfigurationError} If the configuration is invalid
   */
  private validateConfig(): void {
    if (!this.config.defaultBucket) {
      throw new ConfigurationError(
        ERROR_MESSAGES.INVALID_BUCKET_NAME,
        { config: this.config }
      );
    }

    if (!this.config.baseUrl) {
      throw new ConfigurationError(
        ERROR_MESSAGES.MISSING_BASE_URL,
        { config: this.config }
      );
    }
  }

  /**
   * Log a message if logging is enabled
   * @private
   * @param level The log level (info, warn, error)
   * @param message The message to log
   * @param data Additional data to log
   */
  private log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    if (!this.config.enableLogging) return;

    const logData = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...data
    };

    switch (level) {
      case 'info':
        console.info(`[StoragePathUtil] ${message}`, data);
        break;
      case 'warn':
        console.warn(`[StoragePathUtil] ${message}`, data);
        break;
      case 'error':
        console.error(`[StoragePathUtil] ${message}`, data);
        break;
    }
  }

  /**
   * Get the storage path for an audio file
   * @param userId The user ID who owns the file
   * @param fileName The name of the file
   * @returns The standardized path for the audio file
   * @throws {PathConstructionError} If the path cannot be constructed
   */
  getAudioPath(userId: string, fileName: string): string {
    try {
      if (!userId) {
        throw new PathConstructionError(
          ERROR_MESSAGES.MISSING_USER_ID,
          { userId, fileName }
        );
      }

      if (!fileName) {
        throw new PathConstructionError(
          ERROR_MESSAGES.MISSING_FILE_NAME,
          { userId, fileName }
        );
      }

      const path = `${this.config.audioPathPrefix}/${userId}/${fileName}`;
      this.log('info', 'Audio path constructed', { userId, fileName, path });
      return path;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new PathConstructionError(
        ERROR_MESSAGES.PATH_CONSTRUCTION_ERROR,
        { userId, fileName, originalError: error }
      );
    }
  }

  /**
   * Get the full storage path including bucket
   * @param path The file path within the bucket
   * @param bucket Optional bucket name, defaults to the configured default bucket
   * @returns The full storage path including bucket
   * @throws {PathConstructionError} If the path cannot be constructed
   */
  getFullStoragePath(path: string, bucket?: string): string {
    try {
      if (!path) {
        throw new PathConstructionError(
          'Path is required',
          { path, bucket }
        );
      }

      const bucketName = bucket || this.config.defaultBucket;
      const fullPath = `${bucketName}/${path}`;
      this.log('info', 'Full storage path constructed', { path, bucket, fullPath });
      return fullPath;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new PathConstructionError(
        ERROR_MESSAGES.PATH_CONSTRUCTION_ERROR,
        { path, bucket, originalError: error }
      );
    }
  }

  /**
   * Get a public URL for a file
   * @param path The file path within the bucket
   * @param bucket Optional bucket name, defaults to the configured default bucket
   * @returns The public URL for the file
   * @throws {PathConstructionError} If the URL cannot be constructed
   */
  getPublicUrl(path: string, bucket?: string): string {
    try {
      if (!path) {
        throw new PathConstructionError(
          'Path is required',
          { path, bucket }
        );
      }

      if (!this.config.baseUrl) {
        throw new ConfigurationError(
          ERROR_MESSAGES.MISSING_BASE_URL,
          { config: this.config }
        );
      }

      const bucketName = bucket || this.config.defaultBucket;
      const url = `${this.config.baseUrl}/storage/v1/object/public/${bucketName}/${path}`;
      this.log('info', 'Public URL constructed', { path, bucket, url });
      return url;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new PathConstructionError(
        ERROR_MESSAGES.PATH_CONSTRUCTION_ERROR,
        { path, bucket, originalError: error }
      );
    }
  }

  /**
   * Get a download URL for a file
   * @param path The file path within the bucket
   * @param bucket Optional bucket name, defaults to the configured default bucket
   * @returns The download URL for the file
   * @throws {PathConstructionError} If the URL cannot be constructed
   */
  getDownloadUrl(path: string, bucket?: string): string {
    try {
      if (!path) {
        throw new PathConstructionError(
          'Path is required',
          { path, bucket }
        );
      }

      if (!this.config.baseUrl) {
        throw new ConfigurationError(
          ERROR_MESSAGES.MISSING_BASE_URL,
          { config: this.config }
        );
      }

      const bucketName = bucket || this.config.defaultBucket;
      const url = `${this.config.baseUrl}/storage/v1/object/download/${bucketName}/${path}`;
      this.log('info', 'Download URL constructed', { path, bucket, url });
      return url;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new PathConstructionError(
        ERROR_MESSAGES.PATH_CONSTRUCTION_ERROR,
        { path, bucket, originalError: error }
      );
    }
  }

  /**
   * Parse a file path to extract components
   * @param path The file path to parse
   * @returns An object containing the extracted components (prefix, userId, fileName)
   * @throws {InvalidPathError} If the path cannot be parsed
   */
  parseFilePath(path: string): {
    prefix?: string;
    userId?: string;
    fileName: string;
  } {
    try {
      if (!path) {
        throw new InvalidPathError(
          'Path is required',
          { path }
        );
      }

      const parts = path.split('/');
      if (parts.length === 1) {
        this.log('info', 'Parsed file path with fileName only', { path, result: { fileName: parts[0] } });
        return { fileName: parts[0] };
      }
      if (parts.length === 2) {
        this.log('info', 'Parsed file path with userId and fileName', { 
          path, 
          result: { userId: parts[0], fileName: parts[1] } 
        });
        return { userId: parts[0], fileName: parts[1] };
      }
      if (parts.length >= 3) {
        const result = {
          prefix: parts[0],
          userId: parts[1],
          fileName: parts[2]
        };
        this.log('info', 'Parsed file path with prefix, userId, and fileName', { path, result });
        return result;
      }
      
      this.log('warn', 'Path format not recognized, returning fileName only', { path });
      return { fileName: path };
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new InvalidPathError(
        ERROR_MESSAGES.INVALID_PATH_ERROR,
        { path, originalError: error }
      );
    }
  }

  /**
   * Generate a formatted filename for storage
   * @param originalFilename The original filename
   * @returns A formatted filename with timestamp and random string
   * @throws {PathConstructionError} If the filename cannot be generated
   */
  generateFormattedFilename(originalFilename: string): string {
    try {
      if (!originalFilename) {
        throw new PathConstructionError(
          'Original filename is required',
          { originalFilename }
        );
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const randomString = Math.random().toString(36).substring(2, 8);
      const extension = originalFilename.split('.').pop() || '';
      const baseName = originalFilename.split('.').slice(0, -1).join('.') || 'file';
      
      // Sanitize the base name to remove special characters
      const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');
      
      const formattedFilename = `${sanitizedBaseName}_${timestamp}_${randomString}.${extension}`;
      this.log('info', 'Generated formatted filename', { originalFilename, formattedFilename });
      return formattedFilename;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new PathConstructionError(
        ERROR_MESSAGES.PATH_CONSTRUCTION_ERROR,
        { originalFilename, originalError: error }
      );
    }
  }

  /**
   * Normalize a file path to ensure it follows the standard format
   * @param path The file path to normalize
   * @returns The normalized path
   * @throws {InvalidPathError} If the path cannot be normalized
   */
  normalizePath(path: string): string {
    try {
      if (!path) {
        throw new InvalidPathError(
          'Path is required',
          { path }
        );
      }

      const { prefix, userId, fileName } = this.parseFilePath(path);
      
      if (!userId) {
        throw new InvalidPathError(
          ERROR_MESSAGES.MISSING_USER_ID,
          { path, parsedPath: { prefix, userId, fileName } }
        );
      }
      
      // If the path already has the correct prefix, return it as is
      if (prefix === this.config.audioPathPrefix) {
        this.log('info', 'Path already normalized', { path });
        return path;
      }
      
      // Otherwise, construct the path with the correct prefix
      const normalizedPath = this.getAudioPath(userId, fileName);
      this.log('info', 'Path normalized', { originalPath: path, normalizedPath });
      return normalizedPath;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new InvalidPathError(
        ERROR_MESSAGES.INVALID_PATH_ERROR,
        { path, originalError: error }
      );
    }
  }

  /**
   * Check if a path follows the standard format
   * @param path The file path to check
   * @returns True if the path follows the standard format, false otherwise
   * @throws {InvalidPathError} If the path cannot be checked
   */
  isStandardPath(path: string): boolean {
    try {
      if (!path) {
        throw new InvalidPathError(
          'Path is required',
          { path }
        );
      }

      const { prefix } = this.parseFilePath(path);
      const isStandard = prefix === this.config.audioPathPrefix;
      this.log('info', 'Checked if path follows standard format', { path, isStandard });
      return isStandard;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new InvalidPathError(
        ERROR_MESSAGES.INVALID_PATH_ERROR,
        { path, originalError: error }
      );
    }
  }

  /**
   * Get the bucket configuration
   * @returns The current bucket configuration
   */
  getBucketConfig(): StorageConfig {
    return { ...this.config };
  }

  /**
   * Get a user-friendly error message for a storage error
   * @param error The error to get a message for
   * @returns A user-friendly error message
   */
  getUserFriendlyErrorMessage(error: unknown): string {
    if (error instanceof StorageError) {
      return ERROR_MESSAGES[error.code as keyof typeof ERROR_MESSAGES] || error.message;
    }
    
    if (error instanceof Error) {
      return error.message;
    }
    
    return 'An unknown error occurred while accessing storage.';
  }

  /**
   * Execute a function with retry logic
   * @param operation The function to execute
   * @param maxRetries Maximum number of retries
   * @param delay Delay between retries in milliseconds
   * @returns The result of the operation
   * @throws The error from the operation if it fails after all retries
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.config.maxRetries || 3,
    delay: number = this.config.retryDelay || 500
  ): Promise<T> {
    let lastError: unknown;
    
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt <= maxRetries) {
          this.log('warn', `Operation failed, retrying (${attempt}/${maxRetries})`, { error });
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
    }
    
    this.log('error', 'Operation failed after all retries', { error: lastError });
    throw lastError;
  }
}

// Create a singleton instance with default configuration
export const storagePathUtil = new StoragePathUtil(); 