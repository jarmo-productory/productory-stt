import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StoragePathUtil, StorageError, PathConstructionError } from './storage';

describe('StoragePathUtil', () => {
  let storagePathUtil: StoragePathUtil;

  beforeEach(() => {
    // Create a new instance for each test
    storagePathUtil = new StoragePathUtil({
      baseUrl: 'https://example.com',
      defaultBucket: 'test-bucket',
      audioPathPrefix: 'audio',
      enableLogging: false
    });
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