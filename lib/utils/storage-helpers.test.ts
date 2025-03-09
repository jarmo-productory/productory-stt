import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  uploadFile, 
  downloadFile, 
  getFileUrl, 
  deleteFile, 
  getStorageErrorMessage, 
  fileExists,
  type StorageResult
} from './storage-helpers';
import { storagePathUtil, StorageError } from './storage';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock the Supabase client
const mockSupabase = {
  storage: {
    from: vi.fn().mockReturnThis(),
    upload: vi.fn(),
    download: vi.fn(),
    remove: vi.fn(),
    list: vi.fn(),
    createSignedUrl: vi.fn()
  }
};

// Mock the storagePathUtil
vi.mock('./storage', () => ({
  storagePathUtil: {
    generateFormattedFilename: vi.fn().mockImplementation((filename: string) => `formatted_${filename}`),
    getAudioPath: vi.fn().mockImplementation((userId: string, fileName: string) => `audio/${userId}/${fileName}`),
    getPublicUrl: vi.fn().mockImplementation((path: string, bucket?: string) => `https://example.com/storage/v1/object/public/${bucket || 'audio-files'}/${path}`),
    getDownloadUrl: vi.fn().mockImplementation((path: string, bucket?: string) => `https://example.com/storage/v1/object/download/${bucket || 'audio-files'}/${path}`),
    isStandardPath: vi.fn().mockImplementation((path: string) => path.startsWith('audio/')),
    normalizePath: vi.fn().mockImplementation((path: string) => `audio/user-id/${path}`),
    getBucketConfig: vi.fn().mockReturnValue({
      defaultBucket: 'audio-files',
      audioPathPrefix: 'audio'
    }),
    withRetry: vi.fn().mockImplementation((fn: () => Promise<any>) => fn()),
    getUserFriendlyErrorMessage: vi.fn().mockImplementation((error: unknown) => 'User-friendly error message')
  },
  StorageError: class StorageError extends Error {
    constructor(message: string, public code: string) {
      super(message);
      this.name = 'StorageError';
    }
  }
}));

describe('storage-helpers', () => {
  const mockUserId = 'user-123';
  const mockFilePath = `audio/${mockUserId}/test-file.mp3`;
  const mockFile = new File(['test content'], 'test-file.mp3', { type: 'audio/mp3' });
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('uploadFile', () => {
    it('should upload a file successfully', async () => {
      // Setup
      mockSupabase.storage.from().upload.mockResolvedValue({
        data: { path: mockFilePath },
        error: null
      });

      // Execute
      const result = await uploadFile(
        mockSupabase as unknown as SupabaseClient,
        mockFile,
        mockUserId
      );

      // Verify
      expect(storagePathUtil.generateFormattedFilename).toHaveBeenCalledWith(mockFile.name);
      expect(storagePathUtil.getAudioPath).toHaveBeenCalledWith(mockUserId, 'formatted_test-file.mp3');
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('audio-files');
      expect(mockSupabase.storage.from().upload).toHaveBeenCalledWith(
        mockFilePath,
        mockFile,
        {
          cacheControl: '3600',
          upsert: false
        }
      );
      expect(storagePathUtil.getPublicUrl).toHaveBeenCalledWith(mockFilePath);
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.data).toEqual({
        path: mockFilePath,
        url: `https://example.com/storage/v1/object/public/audio-files/${mockFilePath}`
      });
    });

    it('should handle upload errors', async () => {
      // Setup
      const mockError = new Error('Upload failed');
      mockSupabase.storage.from().upload.mockResolvedValue({
        data: null,
        error: mockError
      });

      // Execute
      const result = await uploadFile(
        mockSupabase as unknown as SupabaseClient,
        mockFile,
        mockUserId
      );

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
      expect(result.data).toBeNull();
    });

    it('should use custom options when provided', async () => {
      // Setup
      mockSupabase.storage.from().upload.mockResolvedValue({
        data: { path: mockFilePath },
        error: null
      });

      // Execute
      const result = await uploadFile(
        mockSupabase as unknown as SupabaseClient,
        mockFile,
        mockUserId,
        {
          cacheControl: '7200',
          upsert: true
        }
      );

      // Verify
      expect(mockSupabase.storage.from().upload).toHaveBeenCalledWith(
        mockFilePath,
        mockFile,
        {
          cacheControl: '7200',
          upsert: true
        }
      );
      expect(result.success).toBe(true);
    });
  });

  describe('downloadFile', () => {
    it('should download a file successfully', async () => {
      // Setup
      const mockBlob = new Blob(['test content'], { type: 'audio/mp3' });
      mockSupabase.storage.from().download.mockResolvedValue({
        data: mockBlob,
        error: null
      });

      // Execute
      const result = await downloadFile(
        mockSupabase as unknown as SupabaseClient,
        mockFilePath
      );

      // Verify
      expect(storagePathUtil.isStandardPath).toHaveBeenCalledWith(mockFilePath);
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('audio-files');
      expect(mockSupabase.storage.from().download).toHaveBeenCalledWith(mockFilePath, {});
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockBlob);
    });

    it('should normalize non-standard paths', async () => {
      // Setup
      const mockBlob = new Blob(['test content'], { type: 'audio/mp3' });
      const nonStandardPath = 'test-file.mp3';
      const normalizedPath = `audio/user-id/${nonStandardPath}`;
      
      storagePathUtil.isStandardPath = vi.fn().mockReturnValue(false);
      mockSupabase.storage.from().download.mockResolvedValue({
        data: mockBlob,
        error: null
      });

      // Execute
      const result = await downloadFile(
        mockSupabase as unknown as SupabaseClient,
        nonStandardPath
      );

      // Verify
      expect(storagePathUtil.isStandardPath).toHaveBeenCalledWith(nonStandardPath);
      expect(storagePathUtil.normalizePath).toHaveBeenCalledWith(nonStandardPath);
      expect(mockSupabase.storage.from().download).toHaveBeenCalledWith(normalizedPath, {});
      expect(result.success).toBe(true);
    });

    it('should handle download errors', async () => {
      // Setup
      const mockError = new Error('Download failed');
      mockSupabase.storage.from().download.mockResolvedValue({
        data: null,
        error: mockError
      });

      // Execute
      const result = await downloadFile(
        mockSupabase as unknown as SupabaseClient,
        mockFilePath
      );

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
      expect(result.data).toBeNull();
    });

    it('should use transform options when provided', async () => {
      // Setup
      const mockBlob = new Blob(['test content'], { type: 'audio/mp3' });
      mockSupabase.storage.from().download.mockResolvedValue({
        data: mockBlob,
        error: null
      });

      // Execute
      const result = await downloadFile(
        mockSupabase as unknown as SupabaseClient,
        mockFilePath,
        {
          transform: {
            width: 100,
            height: 100,
            resize: 'cover'
          }
        }
      );

      // Verify
      expect(mockSupabase.storage.from().download).toHaveBeenCalledWith(
        mockFilePath,
        {
          transform: {
            width: 100,
            height: 100,
            resize: 'cover'
          }
        }
      );
      expect(result.success).toBe(true);
    });
  });

  describe('getFileUrl', () => {
    it('should get a public URL for a file', () => {
      // Execute
      const result = getFileUrl(mockFilePath);

      // Verify
      expect(storagePathUtil.isStandardPath).toHaveBeenCalledWith(mockFilePath);
      expect(storagePathUtil.getPublicUrl).toHaveBeenCalledWith(mockFilePath, undefined);
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.data).toEqual(`https://example.com/storage/v1/object/public/audio-files/${mockFilePath}`);
    });

    it('should get a download URL when download option is true', () => {
      // Execute
      const result = getFileUrl(mockFilePath, { download: true });

      // Verify
      expect(storagePathUtil.getDownloadUrl).toHaveBeenCalledWith(mockFilePath, undefined);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(`https://example.com/storage/v1/object/download/audio-files/${mockFilePath}`);
    });

    it('should use custom bucket when provided', () => {
      // Execute
      const result = getFileUrl(mockFilePath, { bucket: 'custom-bucket' });

      // Verify
      expect(storagePathUtil.getPublicUrl).toHaveBeenCalledWith(mockFilePath, 'custom-bucket');
      expect(result.success).toBe(true);
    });

    it('should normalize non-standard paths', () => {
      // Setup
      const nonStandardPath = 'test-file.mp3';
      const normalizedPath = `audio/user-id/${nonStandardPath}`;
      
      storagePathUtil.isStandardPath = vi.fn().mockReturnValue(false);

      // Execute
      const result = getFileUrl(nonStandardPath);

      // Verify
      expect(storagePathUtil.isStandardPath).toHaveBeenCalledWith(nonStandardPath);
      expect(storagePathUtil.normalizePath).toHaveBeenCalledWith(nonStandardPath);
      expect(storagePathUtil.getPublicUrl).toHaveBeenCalledWith(normalizedPath, undefined);
      expect(result.success).toBe(true);
    });

    it('should handle errors', () => {
      // Setup
      storagePathUtil.getPublicUrl = vi.fn().mockImplementation(() => {
        throw new Error('URL generation failed');
      });

      // Execute
      const result = getFileUrl(mockFilePath);

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toEqual('URL generation failed');
      expect(result.data).toBeNull();
    });
  });

  describe('deleteFile', () => {
    it('should delete a file successfully', async () => {
      // Setup
      mockSupabase.storage.from().remove.mockResolvedValue({
        data: {},
        error: null
      });

      // Execute
      const result = await deleteFile(
        mockSupabase as unknown as SupabaseClient,
        mockFilePath
      );

      // Verify
      expect(storagePathUtil.isStandardPath).toHaveBeenCalledWith(mockFilePath);
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('audio-files');
      expect(mockSupabase.storage.from().remove).toHaveBeenCalledWith([mockFilePath]);
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should normalize non-standard paths', async () => {
      // Setup
      const nonStandardPath = 'test-file.mp3';
      const normalizedPath = `audio/user-id/${nonStandardPath}`;
      
      storagePathUtil.isStandardPath = vi.fn().mockReturnValue(false);
      mockSupabase.storage.from().remove.mockResolvedValue({
        data: {},
        error: null
      });

      // Execute
      const result = await deleteFile(
        mockSupabase as unknown as SupabaseClient,
        nonStandardPath
      );

      // Verify
      expect(storagePathUtil.isStandardPath).toHaveBeenCalledWith(nonStandardPath);
      expect(storagePathUtil.normalizePath).toHaveBeenCalledWith(nonStandardPath);
      expect(mockSupabase.storage.from().remove).toHaveBeenCalledWith([normalizedPath]);
      expect(result.success).toBe(true);
    });

    it('should handle delete errors', async () => {
      // Setup
      const mockError = new Error('Delete failed');
      mockSupabase.storage.from().remove.mockResolvedValue({
        data: null,
        error: mockError
      });

      // Execute
      const result = await deleteFile(
        mockSupabase as unknown as SupabaseClient,
        mockFilePath
      );

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
      expect(result.data).toBeNull();
    });
  });

  describe('getStorageErrorMessage', () => {
    it('should get a user-friendly error message', () => {
      // Setup
      const mockError = new Error('Storage error');

      // Execute
      const result = getStorageErrorMessage(mockError);

      // Verify
      expect(storagePathUtil.getUserFriendlyErrorMessage).toHaveBeenCalledWith(mockError);
      expect(result).toEqual('User-friendly error message');
    });
  });

  describe('fileExists', () => {
    it('should check if a file exists successfully', async () => {
      // Setup
      mockSupabase.storage.from().list.mockResolvedValue({
        data: [{ name: 'test-file.mp3' }],
        error: null
      });

      // Execute
      const result = await fileExists(
        mockSupabase as unknown as SupabaseClient,
        mockFilePath
      );

      // Verify
      expect(storagePathUtil.isStandardPath).toHaveBeenCalledWith(mockFilePath);
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('audio-files');
      expect(mockSupabase.storage.from().list).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.data).toBe(true);
    });

    it('should return false if file does not exist', async () => {
      // Setup
      mockSupabase.storage.from().list.mockResolvedValue({
        data: [{ name: 'other-file.mp3' }],
        error: null
      });

      // Execute
      const result = await fileExists(
        mockSupabase as unknown as SupabaseClient,
        mockFilePath
      );

      // Verify
      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });

    it('should handle list errors', async () => {
      // Setup
      const mockError = new Error('List failed');
      mockSupabase.storage.from().list.mockResolvedValue({
        data: null,
        error: mockError
      });

      // Execute
      const result = await fileExists(
        mockSupabase as unknown as SupabaseClient,
        mockFilePath
      );

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
      expect(result.data).toBeNull();
    });
  });
}); 