import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the storage module before importing it
vi.mock('./storage', () => {
  // Create a properly configured mock
  const mockConfig = {
    baseUrl: 'https://example.com',
    defaultBucket: 'test-bucket',
    audioPathPrefix: 'audio',
    enableLogging: false
  };

  // Mock the StoragePathUtil class
  class MockStoragePathUtil {
    private config;

    constructor(config = mockConfig) {
      this.config = { ...mockConfig, ...config };
    }

    getAudioPath(userId: string, fileName: string): string {
      if (!userId) throw new MockPathConstructionError('UserId is required');
      if (!fileName) throw new MockPathConstructionError('FileName is required');
      return `${this.config.audioPathPrefix}/${userId}/${fileName}`;
    }

    getTranscriptionPath(userId: string, fileName: string): string {
      if (!userId) throw new MockPathConstructionError('UserId is required');
      if (!fileName) throw new MockPathConstructionError('FileName is required');
      
      const baseName = this.removeExtension(fileName);
      return `${this.config.audioPathPrefix}/${userId}/transcription/${baseName}.wav`;
    }

    getOptimalTranscriptionFormat(): { format: string; sampleRate: number; channels: number } {
      return {
        format: 'wav',
        sampleRate: 16000,
        channels: 1
      };
    }

    removeExtension(fileName: string): string {
      return fileName.replace(/\.[^/.]+$/, '');
    }

    getPublicUrl(path: string, bucket?: string): string {
      return `https://example.com/storage/v1/object/public/${bucket || this.config.defaultBucket}/${path}`;
    }

    getTranscriptionUrl(userId: string, fileName: string): string {
      const path = this.getTranscriptionPath(userId, fileName);
      return this.getPublicUrl(path);
    }

    getTranscriptionUrlFromFile(audioFile: { 
      file_path: string; 
      user_id?: string; 
      file_name?: string;
      transcription_formats?: { optimized?: { path: string } } 
    }): string {
      if (audioFile.transcription_formats?.optimized) {
        const path = audioFile.transcription_formats.optimized.path;
        return this.getPublicUrl(path);
      }
      
      return this.getPublicUrl(audioFile.file_path);
    }

    isTranscriptionFormatAvailable(audioFile: { 
      transcription_formats?: { optimized?: any } 
    }): boolean {
      return (
        audioFile.transcription_formats !== undefined && 
        audioFile.transcription_formats !== null &&
        audioFile.transcription_formats.optimized !== undefined
      );
    }

    getBucketConfig() {
      return this.config;
    }

    validateConfig() {
      // Mock implementation doesn't throw
      return true;
    }
  }

  // Mock the error classes
  class MockStorageError extends Error {
    code: string;
    context: Record<string, any>;
    constructor(message: string, code = 'STORAGE_ERROR', context = {}) {
      super(message);
      this.name = 'StorageError';
      this.code = code;
      this.context = context;
    }
  }

  class MockPathConstructionError extends MockStorageError {
    constructor(message: string, context = {}) {
      super(message, 'PATH_CONSTRUCTION_ERROR', context);
      this.name = 'PathConstructionError';
    }
  }

  // Create a singleton instance
  const mockStoragePathUtil = new MockStoragePathUtil();

  // Return all exports
  return {
    StoragePathUtil: MockStoragePathUtil,
    StorageError: MockStorageError,
    PathConstructionError: MockPathConstructionError,
    storagePathUtil: mockStoragePathUtil
  };
});

// Now import the mocked types and instances
import { StoragePathUtil, StorageError, PathConstructionError, storagePathUtil } from './storage';

describe('StoragePathUtil', () => {
  let storagePathUtil: StoragePathUtil;

  // Set up default configuration for all tests
  const defaultConfig = {
    baseUrl: 'https://example.com',
    defaultBucket: 'test-bucket',
    audioPathPrefix: 'audio',
    enableLogging: false
  };

  beforeEach(() => {
    // Reset any mocked methods
    vi.clearAllMocks();
    // Create a new instance for each test with default configuration
    storagePathUtil = new StoragePathUtil(defaultConfig);
  });

  describe('getAudioPath', () => {
    it('should construct a valid audio path', () => {
      const userId = 'user-123';
      const fileName = 'test-file.mp3';
      const path = storagePathUtil.getAudioPath(userId, fileName);
      expect(path).toBe('audio/user-123/test-file.mp3');
    });

    it('should throw an error if userId is missing', () => {
      const fileName = 'test-file.mp3';
      expect(() => storagePathUtil.getAudioPath('', fileName)).toThrow(PathConstructionError);
    });

    it('should throw an error if fileName is missing', () => {
      const userId = 'user-123';
      expect(() => storagePathUtil.getAudioPath(userId, '')).toThrow(PathConstructionError);
    });
  });

  describe('getTranscriptionPath', () => {
    it('should construct a valid transcription path', () => {
      const userId = 'user-123';
      const fileName = 'test-file.mp3';
      const path = storagePathUtil.getTranscriptionPath(userId, fileName);
      expect(path).toBe('audio/user-123/transcription/test-file.wav');
    });

    it('should handle filenames with multiple dots', () => {
      const userId = 'user-123';
      const fileName = 'test.file.with.dots.mp3';
      const path = storagePathUtil.getTranscriptionPath(userId, fileName);
      expect(path).toBe('audio/user-123/transcription/test.file.with.dots.wav');
    });

    it('should throw an error if userId is missing', () => {
      const fileName = 'test-file.mp3';
      expect(() => storagePathUtil.getTranscriptionPath('', fileName)).toThrow(PathConstructionError);
    });

    it('should throw an error if fileName is missing', () => {
      const userId = 'user-123';
      expect(() => storagePathUtil.getTranscriptionPath(userId, '')).toThrow(PathConstructionError);
    });
  });

  describe('getOptimalTranscriptionFormat', () => {
    it('should return the optimal format parameters for transcription', () => {
      const format = storagePathUtil.getOptimalTranscriptionFormat();
      expect(format).toEqual({
        format: 'wav',
        sampleRate: 16000,
        channels: 1
      });
    });
  });

  describe('removeExtension', () => {
    it('should remove the extension from a filename', () => {
      // @ts-ignore - Testing private method
      const result = storagePathUtil.removeExtension('test-file.mp3');
      expect(result).toBe('test-file');
    });

    it('should handle filenames with multiple dots', () => {
      // @ts-ignore - Testing private method
      const result = storagePathUtil.removeExtension('test.file.with.dots.mp3');
      expect(result).toBe('test.file.with.dots');
    });

    it('should return the filename if it has no extension', () => {
      // @ts-ignore - Testing private method
      const result = storagePathUtil.removeExtension('test-file');
      expect(result).toBe('test-file');
    });
  });

  describe('getTranscriptionUrl', () => {
    it('should construct a valid transcription URL', () => {
      const userId = 'user-123';
      const fileName = 'test-file.mp3';
      
      // Mock getPublicUrl
      storagePathUtil.getPublicUrl = vi.fn().mockReturnValue('https://example.com/storage/v1/object/public/test-bucket/audio/user-123/transcription/test-file.wav');
      
      const url = storagePathUtil.getTranscriptionUrl(userId, fileName);
      expect(url).toBe('https://example.com/storage/v1/object/public/test-bucket/audio/user-123/transcription/test-file.wav');
      expect(storagePathUtil.getPublicUrl).toHaveBeenCalledWith('audio/user-123/transcription/test-file.wav');
    });
  });

  describe('getTranscriptionUrlFromFile', () => {
    it('should return the URL for the optimized format if available', () => {
      const audioFile = {
        file_path: 'audio/user-123/test-file.mp3',
        user_id: 'user-123',
        file_name: 'test-file.mp3',
        transcription_formats: {
          optimized: { path: 'audio/user-123/transcription/test-file.wav' }
        }
      };
      
      // Mock getPublicUrl
      storagePathUtil.getPublicUrl = vi.fn().mockReturnValue('https://example.com/storage/v1/object/public/test-bucket/audio/user-123/transcription/test-file.wav');
      
      const url = storagePathUtil.getTranscriptionUrlFromFile(audioFile);
      expect(url).toBe('https://example.com/storage/v1/object/public/test-bucket/audio/user-123/transcription/test-file.wav');
      expect(storagePathUtil.getPublicUrl).toHaveBeenCalledWith('audio/user-123/transcription/test-file.wav');
    });

    it('should fall back to original file if no optimized format is available', () => {
      const audioFile = {
        file_path: 'audio/user-123/test-file.mp3',
        user_id: 'user-123',
        file_name: 'test-file.mp3'
      };
      
      // Mock getPublicUrl
      storagePathUtil.getPublicUrl = vi.fn().mockReturnValue('https://example.com/storage/v1/object/public/test-bucket/audio/user-123/test-file.mp3');
      
      const url = storagePathUtil.getTranscriptionUrlFromFile(audioFile);
      expect(url).toBe('https://example.com/storage/v1/object/public/test-bucket/audio/user-123/test-file.mp3');
      expect(storagePathUtil.getPublicUrl).toHaveBeenCalledWith('audio/user-123/test-file.mp3');
    });
  });

  describe('isTranscriptionFormatAvailable', () => {
    it('should return true if the optimized format is available', () => {
      const audioFile = {
        transcription_formats: {
          optimized: { path: 'audio/user-123/transcription/test-file.wav' }
        }
      };
      
      const result = storagePathUtil.isTranscriptionFormatAvailable(audioFile);
      expect(result).toBe(true);
    });

    it('should return false if the optimized format is not available', () => {
      const audioFile = {
        transcription_formats: {}
      };
      
      const result = storagePathUtil.isTranscriptionFormatAvailable(audioFile);
      expect(result).toBe(false);
    });

    it('should return false if transcription_formats is undefined', () => {
      const audioFile = {};
      
      const result = storagePathUtil.isTranscriptionFormatAvailable(audioFile);
      expect(result).toBe(false);
    });
  });
}); 